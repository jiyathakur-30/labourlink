import React, { useState, useEffect } from 'react';
import ActivityTimeline from '../../components/ActivityTimeline';
import TrustScoreBreakdownModal from '../../components/TrustScoreBreakdownModal';
import { User } from 'shared-types';

interface CustomerDashboardProps {
  user: User;
  profileId: string;
  onLogout: () => void;
}


interface Recommendation {
  worker_id: string;
  full_name: string;
  rank: number;
  explanation: string;
  match_score: number;
  trust_score: number | null;
  skills: string[];
  distance_km: number;
}

interface Booking {
  id: string;
  worker_id: string;
  worker_name: string;
  status: string;
  scheduled_start: string;
  requirement_text: string;
  payment_amount: number | null;
  payment_status: string | null;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ user, profileId, onLogout }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activeReqId, setActiveReqId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  
  // Modals / Overlays
  const [activeExplainWorkerId, setActiveExplainWorkerId] = useState<string | null>(null);
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [ratingWorkerId, setRatingWorkerId] = useState<string | null>(null);
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState<string>('');
  
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('500');
  const [paymentMethod, setPaymentMethod] = useState<'UPI_VERIFIED' | 'CASH_ATTESTED' | 'BANK_VERIFIED'>('UPI_VERIFIED');

  useEffect(() => {
    fetchBookings();
    fetchRequests();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await fetch(`/api/bookings?userId=${profileId}&role=CUSTOMER`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRequests = async () => {
    // Handled via local activeReqId state after submission
  };

  const handleQuickAction = (actionType: 'plumber' | 'electrician' | 'painter' | 'carpenter') => {
    switch (actionType) {
      case 'plumber':
        setRawText('I need a plumber to fix a leaking pipe in my bathroom as soon as possible.');
        break;
      case 'electrician':
        setRawText('I need a skilled electrician for wiring installation and switchboard repairs.');
        break;
      case 'painter':
        setRawText('I need a painter to repaint my living room wall.');
        break;
      case 'carpenter':
        setRawText('I need a carpenter to fix a broken wooden door hinge.');
        break;
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/customer/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: profileId, raw_text: rawText })
      });

      if (!res.ok) throw new Error('Failed to submit service request');
      const data = await res.json();
      setActiveReqId(data.serviceRequestId);
      setRecommendations(data.recommendations);
      setRawText('');
      alert('Request analyzed by Agent Orchestrator pipeline successfully! Recommendations loaded.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookWorker = async (workerId: string) => {
    if (!activeReqId) return;

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_request_id: activeReqId,
          worker_id: workerId,
          customer_id: profileId
        })
      });

      if (!res.ok) throw new Error('Booking could not be created');
      alert('Booking requested successfully! Worker notified.');
      setActiveReqId(null);
      setRecommendations([]);
      fetchBookings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCompleteBooking = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to mark booking as completed');
      alert('Booking marked as completed successfully!');
      fetchBookings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBookingId || !ratingWorkerId) return;

    try {
      const res = await fetch(`/api/bookings/${ratingBookingId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rater_id: user.id,
          ratee_id: ratingWorkerId,
          score: ratingScore,
          comment: ratingComment
        })
      });

      if (!res.ok) throw new Error('Rating submission failed');
      alert('Rating submitted successfully!');
      setRatingBookingId(null);
      setRatingWorkerId(null);
      setRatingComment('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBookingId) return;

    try {
      const res = await fetch(`/api/bookings/${paymentBookingId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          confirmation_method: paymentMethod
        })
      });

      if (!res.ok) throw new Error('Payment confirmation failed');
      alert('Payment confirmed successfully!');
      setPaymentBookingId(null);
      fetchBookings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      {/* Header Panel */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '16px 24px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', color: '#0f766e', fontWeight: 'bold' }}>LABOURLINK CUSTOMER DASHBOARD</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            Registered Citizen: <strong>{user.full_name}</strong> ({user.phone}) | Role: <strong>Residential Customer</strong>
          </p>
        </div>
        <button 
          onClick={onLogout} 
          style={{ backgroundColor: '#ffffff', color: '#b91c1c', border: '1px solid #fecaca', padding: '6px 12px', fontSize: '13px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout Session
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Post and Booking List */}
        <div>
          {/* Post Service Request */}
          <section className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>
              POST A SERVICE REQUEST
            </h3>
            
            {/* Quick Actions Shortcuts */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '8px' }}>
                Quick Templates (Shortcuts):
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleQuickAction('plumber')} style={quickBtnStyle}>
                  🔧 Need a Plumber
                </button>
                <button type="button" onClick={() => handleQuickAction('electrician')} style={quickBtnStyle}>
                  ⚡ Need an Electrician
                </button>
                <button type="button" onClick={() => handleQuickAction('painter')} style={quickBtnStyle}>
                  🎨 Need a Painter
                </button>
                <button type="button" onClick={() => handleQuickAction('carpenter')} style={quickBtnStyle}>
                  🪚 Need a Carpenter
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitRequest}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold' }}>What help do you need?</label>
                <textarea 
                  className="form-control"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  placeholder="e.g. Need a plumber in Connaught Place area to fix hotel kitchen pipes."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ padding: '8px 16px', backgroundColor: '#0f766e', borderColor: '#0f766e' }}
                disabled={submitting}
              >
                {submitting ? 'Analyzing with Agents...' : 'Find Matches'}
              </button>
            </form>
          </section>

          {/* Recommendations Feed */}
          {recommendations.length > 0 && (
            <section className="card" style={{ marginBottom: '24px', borderColor: '#99f6e4', backgroundColor: '#fafdfd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#0f766e', fontWeight: 'bold' }}>
                  AGENT RECOMMENDATION RESULT
                </h3>
                <button 
                  onClick={() => { setRecommendations([]); setActiveReqId(null); }} 
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}
                >
                  Clear Results
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {recommendations.map((rec) => (
                  <div key={rec.worker_id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                          {rec.full_name}
                        </h4>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {rec.skills.map((s, i) => (
                            <span key={i} style={{ fontSize: '10px', backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', color: '#475569' }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f766e' }}>
                          Match: {rec.match_score}%
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Distance: {rec.distance_km} km away
                        </div>
                      </div>
                    </div>

                    <p style={{ margin: '8px 0', fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
                      {rec.explanation}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#1e293b' }}>
                          Trust Index: <strong>{rec.trust_score !== null ? `${rec.trust_score}/100` : 'Unestablished'}</strong>
                        </span>
                        {rec.trust_score !== null && (
                          <button 
                            onClick={() => setActiveExplainWorkerId(rec.worker_id)} 
                            style={{ background: 'none', border: 'none', color: '#0f766e', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                          >
                            Why am I seeing this score?
                          </button>
                        )}
                      </div>
                      <button 
                        onClick={() => handleBookWorker(rec.worker_id)}
                        style={{ backgroundColor: '#0f766e', color: '#ffffff', border: 'none', padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Book Worker
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Bookings List */}
          <section className="card">
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>
              RESIDENTIAL BOOKINGS HISTORY
            </h3>

            {bookings.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: '6px', color: '#64748b', fontSize: '13px' }}>
                No bookings registered under this profile.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {bookings.map((b) => (
                  <div key={b.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Booking ID: {b.id.substring(0, 8)}...</span>
                        <h4 style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                          Worker: {b.worker_name}
                        </h4>
                      </div>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 'bold', 
                        padding: '3px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: b.status === 'COMPLETED' ? '#e2f5f3' : (b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS' ? '#fffbeb' : '#f1f5f9'), 
                        color: b.status === 'COMPLETED' ? '#0f766e' : (b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS' ? '#d97706' : '#475569') 
                      }}>
                        {b.status}
                      </span>
                    </div>

                    <p style={{ margin: '6px 0', fontSize: '12px', color: '#475569' }}>
                      Requirement: <em>"{b.requirement_text}"</em>
                    </p>

                    {b.payment_amount && (
                      <div style={{ fontSize: '12px', color: '#172554', margin: '4px 0' }}>
                        UPI Payment: <strong>Rs. {b.payment_amount}</strong> ({b.payment_status})
                      </div>
                    )}

                    {/* Booking Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', justifyContent: 'flex-end' }}>
                      {b.status === 'ACCEPTED' && (
                        <button 
                          onClick={() => handleCompleteBooking(b.id)}
                          style={actionBtnStyle}
                        >
                          Complete Booking
                        </button>
                      )}
                      
                      {b.status === 'COMPLETED' && !b.payment_amount && (
                        <button 
                          onClick={() => { setPaymentBookingId(b.id); setPaymentAmount('500'); }}
                          style={{ ...actionBtnStyle, backgroundColor: '#d97706', color: '#ffffff' }}
                        >
                          💸 Pay Worker
                        </button>
                      )}

                      {b.status === 'COMPLETED' && (
                        <button 
                          onClick={() => { setRatingBookingId(b.id); setRatingWorkerId(b.worker_id); }}
                          style={actionBtnStyle}
                        >
                          ⭐ Rate Worker
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Timeline */}
        <div>
          <section className="card">
            <ActivityTimeline userId={user.id} />
          </section>
        </div>
      </div>

      {/* Trust explanation modal */}
      {activeExplainWorkerId && (
        <TrustScoreBreakdownModal 
          workerId={activeExplainWorkerId} 
          onClose={() => setActiveExplainWorkerId(null)} 
        />
      )}

      {/* Rate worker modal */}
      {ratingBookingId && (
        <div style={backdropStyle}>
          <div style={modalStyle}>
            <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>Rate Worker Performance</h3>
            </div>
            <form onSubmit={handleRatingSubmit}>
              <div style={{ padding: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Score (1 to 5 Stars)</label>
                  <select 
                    className="form-control"
                    value={ratingScore} 
                    onChange={(e) => setRatingScore(parseInt(e.target.value))}
                  >
                    <option value={5}>5 Stars - Excellent (बहुत बढ़िया)</option>
                    <option value={4}>4 Stars - Good (अच्छा)</option>
                    <option value={3}>3 Stars - Average (ठीक ठाक)</option>
                    <option value={2}>2 Stars - Poor (खराब)</option>
                    <option value={1}>1 Star - Critical / Collusion Test (बहुत खराब)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Comments / Review</label>
                  <textarea 
                    className="form-control"
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Enter honest feedback. Rating cluster patterns are audited by Trust Agent."
                    required
                  />
                </div>
              </div>
              <div style={modalFooterStyle}>
                <button type="button" onClick={() => { setRatingBookingId(null); setRatingWorkerId(null); }} style={cancelBtnStyle}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Rating</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment confirmation modal */}
      {paymentBookingId && (
        <div style={backdropStyle}>
          <div style={modalStyle}>
            <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>Attest & Confirm Payment</h3>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div style={{ padding: '20px' }}>
                <div className="form-group">
                  <label className="form-label">UPI Amount Paid (Rs.)</label>
                  <input 
                    type="number"
                    className="form-control"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Attestation Channel</label>
                  <select 
                    className="form-control"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="UPI_VERIFIED">UPI Transaction Verification</option>
                    <option value="CASH_ATTESTED">Cash Hand-to-Hand Attested</option>
                    <option value="BANK_VERIFIED">Direct IMPS/Bank Transferred</option>
                  </select>
                </div>
              </div>
              <div style={modalFooterStyle}>
                <button type="button" onClick={() => setPaymentBookingId(null)} style={cancelBtnStyle}>Cancel</button>
                <button type="submit" className="btn btn-primary">Attest Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

const quickBtnStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #cbd5e1',
  padding: '6px 12px',
  borderRadius: '4px',
  fontSize: '12px',
  cursor: 'pointer',
  color: '#334155',
  transition: 'all 0.1s ease'
};

const actionBtnStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  border: '1px solid #cbd5e1',
  color: '#334155',
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: 'bold',
  borderRadius: '4px',
  cursor: 'pointer'
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999
};

const modalStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  width: '100%',
  maxWidth: '440px',
  borderRadius: '6px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
  overflow: 'hidden'
};

const modalFooterStyle: React.CSSProperties = {
  padding: '12px 20px',
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #cbd5e1',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px'
};

const cancelBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #cbd5e1',
  padding: '6px 12px',
  borderRadius: '4px',
  fontSize: '13px',
  cursor: 'pointer',
  color: '#475569'
};

export default CustomerDashboard;
