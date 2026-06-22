import React, { useState, useEffect } from 'react';
import { User } from 'shared-types';
import EmptyState from '../../components/shared/EmptyState';
import { Building, UserCheck } from 'lucide-react';
import ActivityTimeline from '../../components/ActivityTimeline';

interface ContractorDashboardProps {
  user: User;
  profileId: string;
  onLogout: () => void;
}

export const ContractorDashboard: React.FC<ContractorDashboardProps> = ({ user, profileId, onLogout }) => {
  const [jobText, setJobText] = useState<string>('');
  const [loadingPipeline, setLoadingPipeline] = useState<boolean>(false);
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [reqDetails, setReqDetails] = useState<any | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);

  // Modal / overlay states for actions
  const [selectedWorker, setSelectedWorker] = useState<any | null>(null); // For drill down
  const [payingJob, setPayingJob] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'UPI_VERIFIED' | 'CASH_ATTESTED' | 'BANK_VERIFIED'>('UPI_VERIFIED');

  const [ratingJob, setRatingJob] = useState<any | null>(null);
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');

  const [disputeJob, setDisputeJob] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState<string>('');

  useEffect(() => {
    fetchDashboardData();
  }, [profileId]);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Contractor Profile
      const profRes = await fetch(`/api/auth/me`);
      if (profRes.ok) {
        await profRes.json();
        // Look up contractor info
        const cRes = await fetch(`/api/jobs?userId=${profileId}&role=CONTRACTOR`);
        if (cRes.ok) {
          const cJobs = await cRes.json();
          setActiveJobs(cJobs);
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handlePostRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobText.trim()) return;

    setLoadingPipeline(true);
    try {
      const response = await fetch('/api/jobs/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractor_id: profileId, raw_text: jobText })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to submit requirement');

      setActiveReqId(resData.jobRequirementId);
      
      // Fetch details of created requirement
      const reqRes = await fetch(`/api/jobs/requirements/${resData.jobRequirementId}`);
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setReqDetails(reqData);
      }

      setRecommendations(resData.recommendations);
      setJobText('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingPipeline(false);
    }
  };

  const handleCreateOffer = async (workerId: string) => {
    if (!activeReqId) return;

    try {
      const response = await fetch('/api/jobs/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_requirement_id: activeReqId,
          worker_id: workerId,
          contractor_id: profileId
        })
      });

      if (!response.ok) throw new Error('Failed to create job offer');
      alert('Job offer sent to worker successfully.');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/complete`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to mark job as complete');
      alert('Job marked as completed. Awaiting payment and ratings.');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingJob || !payAmount) return;

    try {
      const response = await fetch(`/api/jobs/${payingJob.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          confirmation_method: payMethod
        })
      });

      if (!response.ok) throw new Error('Failed to submit payment');
      
      alert('Payment confirmed and updated on worker trust log.');
      setPayingJob(null);
      setPayAmount('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingJob) return;

    try {
      const response = await fetch(`/api/jobs/${ratingJob.id}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rater_id: user.id,
          ratee_id: ratingJob.worker_id,
          score: ratingScore,
          comment: ratingComment
        })
      });

      if (!response.ok) throw new Error('Failed to submit rating');
      
      alert('Rating submitted successfully. Worker Trust Score has been updated.');
      setRatingJob(null);
      setRatingComment('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeJob || !disputeReason) return;

    try {
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: disputeJob.id,
          raised_by: user.id,
          reason: disputeReason,
          evidence: {}
        })
      });

      if (!response.ok) throw new Error('Failed to raise dispute');

      alert('Dispute raised. The dispute record is sent to Meera (Trust & Safety Admin).');
      setDisputeJob(null);
      setDisputeReason('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="header-bar">
        <div className="header-title">
          <Building size={28} />
          LabourLink Contractor Portal (नियोजक Hub)
        </div>
        <div className="header-meta">
          <strong>{user.full_name}</strong> | UID: {profileId.slice(0,8)}<br />
          <button className="btn btn-accent" style={{ padding: '2px 8px', fontSize: '11px', marginTop: '4px' }} onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="container">
        <div className="grid-aside">
          
          {/* LEFT: Post new jobs */}
          <div>
            <div className="card">
              <h4 className="card-title">Describe Job Requirements</h4>
              <form onSubmit={handlePostRequirement}>
                <div className="form-group">
                  <label className="form-label">Search Query (NLU NLP Input)</label>
                  <textarea 
                    className="form-control"
                    style={{ height: '120px', fontFamily: 'Arial, sans-serif' }}
                    value={jobText}
                    onChange={(e) => setJobText(e.target.value)}
                    placeholder="Example: Need 2 masons in Connaught Place area for tiling work tomorrow, must have minimum trust score 80, paying Rs 600 to 800 per day."
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    * AI agent parses skills, location, headcount, pay rates, urgency, and trust requirements dynamically.
                  </span>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loadingPipeline}>
                  {loadingPipeline ? 'Orchestrating Agents...' : 'Run Match Agents'}
                </button>
              </form>
            </div>

            {reqDetails && (
              <div className="card">
                <h4 className="card-title">Parsed Job parameters</h4>
                <dl className="details-list">
                  <dt>Target Skills</dt>
                  <dd>
                    {reqDetails.extracted_skills.map((s: string) => (
                      <span key={s} className="badge badge-neutral" style={{ marginRight: '4px' }}>{s}</span>
                    ))}
                  </dd>
                  <dt>Coordinates / Location</dt>
                  <dd>{reqDetails.lat.toFixed(4)} N, {reqDetails.lng.toFixed(4)} E (Radius: {reqDetails.radius_km} km)</dd>
                  <dt>Target Headcount</dt>
                  <dd><strong>{reqDetails.headcount} worker(s)</strong></dd>
                  <dt>Pay Range</dt>
                  <dd>Rs. {reqDetails.pay_min} - Rs. {reqDetails.pay_max} / day</dd>
                  <dt>Minimum Trust Requirement</dt>
                  <dd>{reqDetails.min_trust_score !== null ? <strong>{reqDetails.min_trust_score} Index</strong> : 'None established'}</dd>
                </dl>
              </div>
            )}

            <div className="card" style={{ marginTop: '20px' }}>
              <ActivityTimeline userId={user.id} />
            </div>
          </div>

          {/* RIGHT: Recommendations list & Active Jobs */}
          <div>
            {/* Recommendations Section */}
            {activeReqId && (
              <div className="card" style={{ border: '2px solid var(--primary-color)' }}>
                <h4 className="card-title" style={{ borderBottomColor: 'var(--primary-color)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)' }}>
                    <UserCheck size={20} />
                    Agentic Worker Recommendations ( ranked by match score )
                  </span>
                </h4>
                
                {recommendations.length === 0 ? (
                  <EmptyState variant="recommendations" message="No matching available workers found satisfying the coordinates, skills, and minimum trust score criteria." />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {recommendations.map((rec, index) => (
                      <div 
                        key={rec.worker_id} 
                        style={{ 
                          padding: '16px', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: 'var(--border-radius)',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 'bold' }}>
                            {index + 1}. {rec.name}
                          </span>
                          
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Match Index: <strong>{rec.evidence?.match_score || 0}%</strong>
                            </span>
                            <span className="badge badge-success" style={{ 
                              backgroundColor: rec.trust_score >= 85 ? 'var(--trust-high)20' : (rec.trust_score >= 70 ? 'var(--trust-medium)20' : 'var(--trust-low)20'),
                              color: rec.trust_score >= 85 ? 'var(--trust-high)' : (rec.trust_score >= 70 ? 'var(--trust-medium)' : 'var(--trust-low)'),
                              border: `1px solid ${rec.trust_score >= 85 ? 'var(--trust-high)' : (rec.trust_score >= 70 ? 'var(--trust-medium)' : 'var(--trust-low)')}`
                            }}>
                              Trust: {rec.trust_score !== null ? rec.trust_score : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <p style={{ fontSize: '13px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '2px', borderLeft: '3px solid var(--primary-color)', marginBottom: '12px' }}>
                          {rec.explanation}
                        </p>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => setSelectedWorker(rec)}
                          >
                            View Audit Evidence
                          </button>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '4px 10px', fontSize: '12px', marginLeft: 'auto' }}
                            onClick={() => handleCreateOffer(rec.worker_id)}
                          >
                            Send Hiring Offer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Jobs Lifecycle */}
            <div className="card" style={{ marginTop: '20px' }}>
              <h4 className="card-title">Manage Hired Workers & Job States</h4>
              {activeJobs.length === 0 ? (
                <EmptyState variant="contractor_jobs" />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Status</th>
                      <th>Pay Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeJobs.map(job => (
                      <tr key={job.id}>
                        <td>
                          <strong>{job.worker_name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Requirement: {job.requirement_text.slice(0, 50)}...</div>
                        </td>
                        <td>
                          <span className={`badge ${job.status === 'COMPLETED' ? 'badge-success' : (job.status === 'DISPUTED' ? 'badge-danger' : 'badge-warning')}`}>
                            {job.status}
                          </span>
                        </td>
                        <td>Rs. {job.payment_amount || 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {job.status === 'ACCEPTED' && (
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Worker traveling...</span>
                            )}
                            {job.status === 'OFFERED' && (
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Awaiting worker acceptance</span>
                            )}
                            {job.status === 'IN_PROGRESS' && (
                              <button className="btn btn-primary" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => handleCompleteJob(job.id)}>
                                Complete Work
                              </button>
                            )}
                            {job.status === 'COMPLETED' && (
                              <>
                                {!job.payment_amount && (
                                  <button className="btn btn-accent" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setPayingJob(job)}>
                                    Make Payment
                                  </button>
                                )}
                                <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setRatingJob(job)}>
                                  Rate Worker
                                </button>
                              </>
                            )}
                            {job.status !== 'DISPUTED' && job.status !== 'CANCELLED' && (
                              <button className="btn btn-danger" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => setDisputeJob(job)}>
                                Raise Dispute
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* DRILL DOWN MODAL: Auditable evidence citations (Rule 6: Citation) */}
      {selectedWorker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px', backgroundColor: '#ffffff', margin: 0 }}>
            <h4 className="card-title">Auditable System Evidence Citation</h4>
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '2px' }}>
                <strong>Worker Name:</strong> {selectedWorker.name}<br />
                <strong>Trust Score version:</strong> v{selectedWorker.evidence?.trust_score !== null ? 1 : 0}<br />
                <strong>Matching Score:</strong> {selectedWorker.evidence?.match_score}%
              </div>
              <h5 style={{ fontWeight: 'bold', color: 'var(--secondary-color)', fontSize: '12px' }}>CITED RECORD IDs IN SQLITE:</h5>
              <ul style={{ paddingLeft: '20px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                <li>Jobs Completed IDs: {JSON.stringify(selectedWorker.evidence?.job_ids || [])}</li>
                <li>Rating Record IDs: {JSON.stringify(selectedWorker.evidence?.rating_ids || [])}</li>
                <li>Verification Record IDs: {JSON.stringify(selectedWorker.evidence?.verification_ids || [])}</li>
                <li>Endorsement Record IDs: {JSON.stringify(selectedWorker.evidence?.endorsement_ids || [])}</li>
                <li>Active Fraud Flag IDs: {JSON.stringify(selectedWorker.evidence?.fraud_flag_ids || [])}</li>
              </ul>
              <div className="seal-container">
                🛡️ Verified Audit logs are locked. Modifying values directly violates framework rules.
              </div>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSelectedWorker(null)}>Close Audit Trace</button>
          </div>
        </div>
      )}

      {/* MODAL: Submit Payment */}
      {payingJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handlePaySubmit} className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: '#ffffff', margin: 0 }}>
            <h4 className="card-title">Submit Secure Payment</h4>
            <div className="form-group">
              <label className="form-label">Payment Amount (Rs.)</label>
              <input 
                type="number" 
                className="form-control"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter exact rupees"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmation Method</label>
              <select className="form-control" value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
                <option value="UPI_VERIFIED">UPI Verified Transaction</option>
                <option value="BANK_VERIFIED">Direct Bank Transfer</option>
                <option value="CASH_ATTESTED">Cash Handover Attested</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPayingJob(null)}>Cancel</button>
              <button type="submit" className="btn btn-accent" style={{ flex: 1 }}>Confirm Payment</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Submit Rating */}
      {ratingJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleRatingSubmit} className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: '#ffffff', margin: 0 }}>
            <h4 className="card-title">Submit Worker Performance Rating</h4>
            <div className="form-group">
              <label className="form-label">Score (1 to 5 Stars)</label>
              <select className="form-control" value={ratingScore} onChange={(e) => setRatingScore(parseInt(e.target.value))}>
                <option value="5">5 Stars — Excellent Performance</option>
                <option value="4">4 Stars — Good performance</option>
                <option value="3">3 Stars — Satisfactory</option>
                <option value="2">2 Stars — Poor, delays/damages</option>
                <option value="1">1 Star — Severe failure/no show</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Performance Review comments</label>
              <textarea 
                className="form-control"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Describe performance..."
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setRatingJob(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Submit Rating</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Raise Dispute */}
      {disputeJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleDisputeSubmit} className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: '#ffffff', margin: 0 }}>
            <h4 className="card-title">Raise Formal Dispute</h4>
            <div className="form-group">
              <label className="form-label">Reason for Dispute</label>
              <textarea 
                className="form-control"
                style={{ height: '100px' }}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe conflict details..."
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDisputeJob(null)}>Cancel</button>
              <button type="submit" className="btn btn-danger" style={{ flex: 1 }}>Raise Conflict</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
export default ContractorDashboard;
