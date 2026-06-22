import React, { useState, useEffect } from 'react';
import { User, WorkerProfile, VerificationRecord, Endorsement, Notification } from 'shared-types';
import TrustScoreGauge from '../../components/trust/TrustScoreGauge';
import VoiceControl from '../../components/shared/VoiceControl';
import EmptyState from '../../components/shared/EmptyState';
import { Clock, XCircle, ShieldCheck, MapPin, Radio, Bell } from 'lucide-react';
import ActivityTimeline from '../../components/ActivityTimeline';

interface WorkerDashboardProps {
  user: User;
  profileId: string;
  onLogout: () => void;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user, profileId, onLogout }) => {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [trustDetails, setTrustDetails] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Verification upload simulation
  const [uploading, setUploading] = useState<boolean>(false);
  const [docType, setDocType] = useState<'ID_DOCUMENT' | 'SKILL_CERT'>('ID_DOCUMENT');
  const [docUrl, setDocUrl] = useState<string>('');

  useEffect(() => {
    fetchDashboardData();
  }, [profileId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Profile
      const profRes = await fetch(`/api/workers/${profileId}/profile`);
      if (!profRes.ok) throw new Error('Failed to fetch worker profile');
      const profData = await profRes.json();
      setProfile(profData);

      // 2. Fetch Trust Score
      const trustRes = await fetch(`/api/workers/${profileId}/trust-score`);
      if (trustRes.ok) {
        const trustData = await trustRes.json();
        setTrustDetails(trustData.status === 'NOT_YET_ESTABLISHED' ? null : trustData);
      }

      // 3. Fetch Jobs
      const jobsRes = await fetch(`/api/jobs?userId=${profileId}&role=WORKER`);
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setJobs(jobsData);
      }

      // 4. Fetch Verifications
      const verifRes = await fetch(`/api/workers/${profileId}/verification-records`);
      if (verifRes.ok) {
        const verifData = await verifRes.json();
        setVerifications(verifData);
      }

      // 5. Fetch Notifications
      const notifRes = await fetch(`/api/notifications?userId=${user.id}`);
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData);
      }

      // 6. Fetch Endorsements
      // There isn't an explicit endpoint for worker endorsements, but they're stored in DB. Let's build a quick fetch.
      // We can query worker profile or do it from db. For simplicity, we fallback if endpoint fails or fetch details.
      const endorsementsRes = await fetch(`/api/workers/${profileId}/endorsements`).catch(() => null);
      if (endorsementsRes && endorsementsRes.ok) {
        const endData = await endorsementsRes.json();
        setEndorsements(endData);
      }

      // Fetch Opportunities
      const oppRes = await fetch(`/api/workers/${profileId}/opportunities`);
      if (oppRes.ok) {
        const oppData = await oppRes.json();
        setOpportunities(oppData);
      }

    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityToggle = async (status: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE') => {
    try {
      const response = await fetch(`/api/workers/${profileId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, set_via: 'UI' })
      });

      if (!response.ok) throw new Error('Failed to update availability');
      
      // Refresh profile & trust score
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docUrl) return;

    setUploading(true);
    try {
      const response = await fetch(`/api/workers/${profileId}/verification-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: docType, evidence_url: docUrl })
      });

      if (!response.ok) throw new Error('Failed to submit document');
      
      setDocUrl('');
      alert('Document submitted and processed by Verification Agent successfully.');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAcceptJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to accept job offer');
      
      alert('Job offer accepted. Your status has been set to BUSY.');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAcceptOpportunity = async (opp: any) => {
    try {
      if (opp.type === 'CUSTOMER_BOOKING') {
        const bookRes = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_request_id: opp.id,
            worker_id: profileId,
            customer_id: opp.customer_id
          })
        });
        if (!bookRes.ok) throw new Error('Failed to create booking for opportunity.');
        const data = await bookRes.json();
        const acceptRes = await fetch(`/api/bookings/${data.bookingId}/accept`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!acceptRes.ok) throw new Error('Failed to accept booking.');
        alert('Ghar ka Kaam (Booking) accepted successfully! Your status is now BUSY.');
      } else {
        const jobRes = await fetch('/api/jobs/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_requirement_id: opp.id,
            worker_id: profileId,
            contractor_id: opp.contractor_id
          })
        });
        if (!jobRes.ok) throw new Error('Failed to apply for contractor job.');
        const data = await jobRes.json();
        const acceptRes = await fetch(`/api/jobs/${data.jobId}/accept`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!acceptRes.ok) throw new Error('Failed to accept job offer.');
        alert('Contractor Job accepted successfully! Your status is now BUSY.');
      }
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReadNotification = async (notifId: string) => {
    try {
      await fetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' });
      fetchDashboardData();
    } catch (e) {}
  };

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', padding: '60px' }}>Loading Official Profile Data...</div>;
  }

  return (
    <div>
      <div className="header-bar">
        <div className="header-title">
          <ShieldCheck size={28} />
          LabourLink Workforce Hub (श्रमिक पोर्टल)
        </div>
        <div className="header-meta">
          <strong>{user.full_name}</strong> | UID: {profile?.id.slice(0,8)}<br />
          <button className="btn btn-accent" style={{ padding: '2px 8px', fontSize: '11px', marginTop: '4px' }} onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className="container">
        {/* Verification Status Banner */}
        <div className="alert-banner alert-banner-info" style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <MapPin size={20} />
            <div>
              <strong>Verification Badge:</strong> Your profile is currently marked as: <strong>{profile?.verification_status}</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Home Location: {profile?.home_lat.toFixed(4)} N, {profile?.home_lng.toFixed(4)} E
              </div>
            </div>
          </div>
          <div className="stamp stamp-verified" style={{ marginLeft: 'auto' }}>
            {profile?.verification_status === 'VERIFIED' ? 'Approved' : 'Pending Review'}
          </div>
        </div>

        <div className="grid-aside">
          
          {/* SIDEBAR: Trust score & Status */}
          <div>
            <div className="card">
              <h4 className="card-title">Availability Status</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  className={`btn ${profile?.availability_status === 'AVAILABLE' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleAvailabilityToggle('AVAILABLE')}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Radio size={16} /> Set Available (काम के लिए उपलब्ध)
                </button>
                <button 
                  className={`btn ${profile?.availability_status === 'BUSY' ? 'btn-accent' : 'btn-secondary'}`}
                  onClick={() => handleAvailabilityToggle('BUSY')}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Clock size={16} /> Set Busy (काम पर व्यस्त)
                </button>
                <button 
                  className={`btn ${profile?.availability_status === 'UNAVAILABLE' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => handleAvailabilityToggle('UNAVAILABLE')}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <XCircle size={16} /> Set Offline (उपलब्ध नहीं)
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
                Current Status: <strong style={{ color: 'var(--primary-color)' }}>{profile?.availability_status}</strong>
              </div>
            </div>

            <TrustScoreGauge 
              score={trustDetails?.score ?? null} 
              version={trustDetails?.version}
              contributingFactors={trustDetails?.contributing_factors}
            />

            {/* Document Submission */}
            <div className="card" style={{ marginTop: '20px' }}>
              <h4 className="card-title">Audit Verification File</h4>
              <form onSubmit={handleDocSubmit}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '12px' }}>File Type</label>
                  <select className="form-control" value={docType} onChange={(e) => setDocType(e.target.value as any)}>
                    <option value="ID_DOCUMENT">Aadhaar / ID Card</option>
                    <option value="SKILL_CERT">Skill Certificate</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '12px' }}>Document URL Link</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="https://docs.link/file.pdf"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '6px' }} disabled={uploading}>
                  {uploading ? 'Scanning...' : 'Submit to Verification Agent'}
                </button>
              </form>

              {verifications.length > 0 && (
                <div style={{ marginTop: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
                  <h5 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px' }}>Submitted Files Checklist</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {verifications.map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '4px 8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '2px' }}>
                        <span style={{ textTransform: 'capitalize' }}>{v.type.toLowerCase().replace('_', ' ')}</span>
                        <span className={`badge ${v.status === 'VERIFIED' ? 'badge-success' : (v.status === 'REJECTED' ? 'badge-danger' : 'badge-warning')}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Reusable Activity Timeline */}
            <div className="card" style={{ marginTop: '20px' }}>
              <ActivityTimeline userId={user.id} />
            </div>
          </div>

          {/* MAIN CONTENT: Jobs, Voice searches, Notifications */}
          <div>
            
            {/* Voice Command panel */}
            <VoiceControl userId={user.id} onCommandProcessed={() => fetchDashboardData()} />

            {/* Opportunity Feed */}
            <div className="card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <h4 className="card-title" style={{ color: 'var(--primary-color)' }}>Opportunity Feed (नये काम के सुझाव)</h4>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '16px' }}>
                Powered by Worker Discovery Agent. Recommended nearby jobs and residential bookings matched for your skills and current coordinates.
              </p>
              
              {opportunities.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)' }}>
                  No new opportunities detected nearby. Try setting your availability status to AVAILABLE.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {opportunities.map((opp) => (
                    <div key={opp.id} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span className={`badge ${opp.type === 'CUSTOMER_BOOKING' ? 'badge-success' : 'badge-primary'}`} style={{ fontSize: '10px', padding: '1px 5px', marginBottom: '4px' }}>
                            {opp.type === 'CUSTOMER_BOOKING' ? 'Residential Booking' : 'Contractor Project'}
                          </span>
                          <h5 style={{ margin: '4px 0', fontSize: '14px', fontWeight: 'bold' }}>{opp.title}</h5>
                          <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{opp.description}</p>
                          <p style={{ margin: '4px 0', fontSize: '11px', color: '#0f766e', fontStyle: 'italic' }}><strong>Reasoning:</strong> {opp.reasoning}</p>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: '90px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--primary-color)' }}>{opp.match_score}% Match</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{opp.distance_km} km away</div>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d97706', marginTop: '4px' }}>Est. Rs. {opp.estimated_earnings}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#0f766e', borderColor: '#0f766e' }}
                          onClick={() => handleAcceptOpportunity(opp)}
                        >
                          Accept Opportunity
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* In-App Notifications Feed */}
            {notifications.length > 0 && (
              <div className="card" style={{ borderLeft: '4px solid var(--accent-color)' }}>
                <h4 className="card-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={18} color="var(--accent-color)" /> Alert & Dispatch Feed
                  </span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      style={{ 
                        padding: '10px', 
                        border: '1px solid var(--border-color)', 
                        backgroundColor: notif.read_at ? '#ffffff' : '#fffbeb',
                        borderRadius: '2px',
                        display: 'flex',
                        justifyContent: 'between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <span className="badge badge-neutral" style={{ marginRight: '6px' }}>{notif.type}</span>
                        <span style={{ fontSize: '13px', fontWeight: notif.read_at ? 'normal' : 'bold' }}>{notif.payload.title}</span>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Channel: {notif.channel}</div>
                      </div>
                      {!notif.read_at && (
                        <button 
                          className="btn btn-secondary" 
                          style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '11px' }}
                          onClick={() => handleReadNotification(notif.id)}
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Jobs Timeline */}
            <div className="card">
              <h4 className="card-title">Secured Job History (रोजगार विवरण)</h4>
              {jobs.length === 0 ? (
                <EmptyState variant="default" message="No jobs found in your history queue. Once a contractor offers you a job, it will appear here." />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Project / Contractor</th>
                      <th>Scheduled Date</th>
                      <th>Amount</th>
                      <th>Payment Status</th>
                      <th>Job Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job: any) => (
                      <tr key={job.id}>
                        <td>
                          <strong>{job.contractor_company || 'Independent Project'}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Requirement: {job.requirement_text.slice(0, 50)}...</div>
                        </td>
                        <td>{new Date(job.scheduled_start).toLocaleDateString()}</td>
                        <td>Rs. {job.payment_amount || 'N/A'}</td>
                        <td>
                          <span className={`badge ${job.payment_status === 'CONFIRMED' ? 'badge-success' : (job.payment_status === 'DISPUTED' ? 'badge-danger' : 'badge-warning')}`}>
                            {job.payment_status || 'PENDING'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${job.status === 'COMPLETED' ? 'badge-success' : (job.status === 'DISPUTED' ? 'badge-danger' : 'badge-warning')}`}>
                            {job.status}
                          </span>
                        </td>
                        <td>
                          {job.status === 'OFFERED' && (
                            <button className="btn btn-accent" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleAcceptJob(job.id)}>
                              Accept Offer
                            </button>
                          )}
                          {job.status === 'ACCEPTED' && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Awaiting work start</span>
                          )}
                          {job.status === 'IN_PROGRESS' && (
                            <span style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 'bold' }}>Active Job Site</span>
                          )}
                          {job.status === 'COMPLETED' && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Record closed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Endorsements Audit */}
            <div className="card">
              <h4 className="card-title">Verifiable Contractor Endorsements</h4>
              {endorsements.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  No verified contractor endorsements recorded yet on your trust profile.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {endorsements.map((end: any) => (
                    <div key={end.id} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '2px', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'between', fontWeight: 'bold', fontSize: '12px', color: 'var(--primary-color)', marginBottom: '4px' }}>
                        <span>Skill: {end.skill}</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>UID: {end.endorser_id.slice(0, 8)}</span>
                      </div>
                      <p style={{ fontSize: '13px', fontStyle: 'italic' }}>"{end.comment}"</p>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', textAlign: 'right' }}>
                        Recorded on: {new Date(end.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
export default WorkerDashboard;
