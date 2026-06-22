import { db } from '../../db/sqlite';
import { v4 as uuidv4 } from 'uuid';

export interface TrustScoreBreakdown {
  jobs_completed: number;
  on_time_rate: number;
  payment_integrity_factor: number;
  average_contractor_rating: number;
  endorsement_factor: number;
  verification_factor: number;
  fraud_penalty: number;
  reliability_consistency_factor: number;
  dispute_outcome_factor: number;
}

export class TrustAgent {
  static async run(workerId: string, agentRunId?: string): Promise<number | null> {
    const startTime = Date.now();
    const runId = agentRunId || uuidv4();
    console.log(`[TrustAgent] Recalculating trust score for worker ID: ${workerId}`);

    try {
      // 1. Fetch completed jobs count & check eligibility
      const completedContractorJobs = db.prepare(`
        SELECT id, scheduled_end, actual_completion FROM jobs 
        WHERE worker_id = ? AND status = 'COMPLETED'
      `).all(workerId) as { id: string; scheduled_end: string; actual_completion: string | null }[];

      const completedCustomerBookings = db.prepare(`
        SELECT id, scheduled_end, actual_completion FROM bookings 
        WHERE worker_id = ? AND status = 'COMPLETED'
      `).all(workerId) as { id: string; scheduled_end: string; actual_completion: string | null }[];

      const completedJobs = [...completedContractorJobs, ...completedCustomerBookings];

      const confirmedPayments = db.prepare(`
        SELECT p.id FROM payments p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.worker_id = ? AND p.status = 'CONFIRMED'
      `).all(workerId);

      // Evidentiary threshold: must have at least 1 completed job AND 1 confirmed payment
      if (completedJobs.length === 0 || confirmedPayments.length === 0) {
        console.log(`[TrustAgent] Worker ${workerId} has not met the evidentiary threshold. Trust score remains NULL.`);
        
        // Update profile
        db.prepare(`
          UPDATE worker_profiles 
          SET trust_score = NULL, trust_score_updated_at = ?, trust_score_version = trust_score_version + 1
          WHERE id = ?
        `).run(new Date().toISOString(), workerId);

        return null;
      }

      // 2. Compute completed_jobs_factor (max 10 points)
      // 2 points per completed job, cap at 10 (5 jobs)
      const completedJobsCount = completedJobs.length;
      const completedJobsFactor = Math.min(completedJobsCount * 2, 10);

      // 3. Compute on_time_completion_rate (max 15 points)
      let onTimeCount = 0;
      completedJobs.forEach(job => {
        if (job.actual_completion && job.scheduled_end) {
          const actual = new Date(job.actual_completion).getTime();
          const scheduled = new Date(job.scheduled_end).getTime();
          if (actual <= scheduled) {
            onTimeCount++;
          }
        }
      });
      const onTimeRate = completedJobsCount > 0 ? (onTimeCount / completedJobsCount) : 0;
      const onTimeCompletionFactor = onTimeRate * 15;

      // 4. Compute payment_integrity_factor (max 15 points)
      // Ratio of confirmed payments vs total payments
      const allPayments = db.prepare(`
        SELECT p.status FROM payments p
        JOIN jobs j ON p.job_id = j.id
        WHERE j.worker_id = ?
      `).all(workerId) as { status: string }[];
      
      const confirmedCount = allPayments.filter(p => p.status === 'CONFIRMED').length;
      const paymentIntegrityRate = allPayments.length > 0 ? (confirmedCount / allPayments.length) : 0;
      const paymentIntegrityFactor = paymentIntegrityRate * 15;

      // 5. Compute average_contractor_rating (max 30 points)
      // Weighted average of ratings
      const workerRatings = db.prepare(`
        SELECT score FROM ratings 
        WHERE ratee_id = (SELECT user_id FROM worker_profiles WHERE id = ?)
      `).all(workerId) as { score: number }[];

      let avgRating = 0;
      if (workerRatings.length > 0) {
        const sum = workerRatings.reduce((acc, r) => acc + r.score, 0);
        avgRating = sum / workerRatings.length;
      }
      // Scale rating out of 5.0 to 30 points
      const averageContractorRatingFactor = avgRating * 6;

      // 6. Compute endorsement_factor (max 10 points)
      // 2 points per endorsement, capped at 10
      const endorsementsCount = (db.prepare(`
        SELECT COUNT(id) as cnt FROM endorsements WHERE worker_id = ?
      `).get(workerId) as { cnt: number }).cnt;
      const endorsementFactor = Math.min(endorsementsCount * 2, 10);

      // 7. Compute verification_factor (max 20 points)
      // ID Document = 10, Skill Cert = 7, Employer Attestation = 3
      const verifications = db.prepare(`
        SELECT type, status FROM verification_records 
        WHERE worker_id = ? AND status = 'VERIFIED'
      `).all(workerId) as { type: string; status: string }[];

      let verificationFactor = 0;
      verifications.forEach(v => {
        if (v.type === 'ID_DOCUMENT') verificationFactor += 10;
        if (v.type === 'SKILL_CERT') verificationFactor += 7;
        if (v.type === 'EMPLOYER_ATTESTATION') verificationFactor += 3;
      });
      verificationFactor = Math.min(verificationFactor, 20);

      // 8. Availability reliability consistency factor (new trust signal, from availability log)
      // Let's implement a penalty for frequent switches or a small bonus for stable availability
      // Max 5 points or deducts. For simplicity, let's keep it as 0 penalty if stable, or -5 if volatile.
      const availabilitySwitches = db.prepare(`
        SELECT COUNT(id) as cnt FROM availability_log WHERE worker_id = ?
      `).get(workerId) as { cnt: number };
      const reliabilityConsistencyFactor = availabilitySwitches.cnt > 10 ? -5 : 0;

      // 9. Dispute outcome factor (disputes resolved against worker)
      const lostDisputes = db.prepare(`
        SELECT COUNT(id) as cnt FROM disputes d
        JOIN jobs j ON d.job_id = j.id
        WHERE j.worker_id = ? AND d.status = 'RESOLVED_CONTRACTOR'
      `).get(workerId) as { cnt: number };
      const disputeOutcomeFactor = lostDisputes.cnt * -10; // -10 points per dispute resolved against worker

      // 10. Fraud Penalty (deducted, scale by severity)
      // Critical = -30, High = -20, Medium = -10, Low = -5
      const activeFlags = db.prepare(`
        SELECT severity FROM fraud_flags 
        WHERE subject_type = 'WORKER' AND subject_id = ? AND status IN ('OPEN', 'CONFIRMED')
      `).all(workerId) as { severity: string }[];

      let fraudPenalty = 0;
      activeFlags.forEach(flag => {
        if (flag.severity === 'CRITICAL') fraudPenalty += 30;
        else if (flag.severity === 'HIGH') fraudPenalty += 20;
        else if (flag.severity === 'MEDIUM') fraudPenalty += 10;
        else if (flag.severity === 'LOW') fraudPenalty += 5;
      });

      // Guardrail from addendum: Voice language preferences are NOT trust signals (do not penalize/reward)

      // 11. Sum up & clamp between 0 and 100
      let totalScore = completedJobsFactor + 
                         onTimeCompletionFactor + 
                         paymentIntegrityFactor + 
                         averageContractorRatingFactor + 
                         endorsementFactor + 
                         verificationFactor + 
                         reliabilityConsistencyFactor + 
                         disputeOutcomeFactor - 
                         fraudPenalty;

      totalScore = Math.max(0, Math.min(Math.round(totalScore), 100));

      const breakdown: TrustScoreBreakdown = {
        jobs_completed: completedJobsFactor,
        on_time_rate: onTimeCompletionFactor,
        payment_integrity_factor: paymentIntegrityFactor,
        average_contractor_rating: averageContractorRatingFactor,
        endorsement_factor: endorsementFactor,
        verification_factor: verificationFactor,
        reliability_consistency_factor: reliabilityConsistencyFactor,
        dispute_outcome_factor: disputeOutcomeFactor,
        fraud_penalty: fraudPenalty
      };

      // Get latest version
      const profile = db.prepare('SELECT trust_score_version FROM worker_profiles WHERE id = ?').get(workerId) as { trust_score_version: number };
      const nextVersion = (profile?.trust_score_version || 0) + 1;

      // Update worker profile
      db.prepare(`
        UPDATE worker_profiles 
        SET trust_score = ?, trust_score_updated_at = ?, trust_score_version = ?
        WHERE id = ?
      `).run(totalScore, new Date().toISOString(), nextVersion, workerId);

      // Insert history log
      db.prepare(`
        INSERT INTO trust_score_history (id, worker_id, score, version, computed_by_agent_run_id, contributing_factors, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), workerId, totalScore, nextVersion, runId, JSON.stringify(breakdown), new Date().toISOString());

      // Write Agent Log
      const latency = Date.now() - startTime;
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'TRUST', '1.0.0', ?, ?, ?, 'SUCCESS', ?, ?)
      `).run(
        runId, 
        JSON.stringify({ workerId }), 
        JSON.stringify({ score: totalScore, breakdown }), 
        JSON.stringify([workerId]), 
        latency, 
        new Date().toISOString()
      );

      console.log(`[TrustAgent] Finished. New score: ${totalScore}`);
      return totalScore;

    } catch (err: any) {
      console.error(`[TrustAgent] Error during calculation for worker ${workerId}:`, err);
      // Graceful log in agent run logs
      db.prepare(`
        INSERT INTO agent_run_logs (id, agent_name, agent_version, input_payload, output_payload, evidence_record_ids, status, latency_ms, created_at)
        VALUES (?, 'TRUST', '1.0.0', ?, ?, '[]', 'FAILURE', ?, ?)
      `).run(
        runId,
        JSON.stringify({ workerId }),
        JSON.stringify({ error: err.message }),
        Date.now() - startTime,
        new Date().toISOString()
      );
      throw err;
    }
  }
}
export default TrustAgent;
