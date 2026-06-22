import React, { useState, useEffect } from 'react';
import { Shield, Lock, Phone } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any, profileId: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [role, setRole] = useState<'WORKER' | 'CUSTOMER' | 'CONTRACTOR' | 'ADMIN'>('WORKER');
  const [isRegister, setIsRegister] = useState<boolean>(false);
  
  // Input fields
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [homeAddress, setHomeAddress] = useState<string>('');
  const [preferredLanguage, setPreferredLanguage] = useState<string>('en');

  // Dynamic Skill Taxonomy Onboarding
  const [skillsTaxonomy, setSkillsTaxonomy] = useState<{ id: string; category: string; name: string }[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    fetchSkills();
    
    // Check initial path route
    const path = window.location.pathname;
    if (path.includes('/auth/customer')) {
      setRole('CUSTOMER');
    } else if (path.includes('/auth/contractor')) {
      setRole('CONTRACTOR');
    } else if (path.includes('/auth/admin')) {
      setRole('ADMIN');
      setIsRegister(false);
    } else {
      setRole('WORKER');
    }
  }, []);

  const fetchSkills = async () => {
    try {
      const res = await fetch('/api/customer/skills');
      if (res.ok) {
        const data = await res.json();
        setSkillsTaxonomy(data);
      }
    } catch (e) {
      console.error('Failed to load skills taxonomy', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setLoading(true);

    const url = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? {
      phone,
      password,
      full_name: fullName,
      role,
      email: email || undefined,
      company_name: role === 'CONTRACTOR' ? companyName : undefined,
      skills: role === 'WORKER' ? selectedSkills : undefined,
      home_address: role === 'CUSTOMER' ? homeAddress : undefined,
      preferred_language: role === 'CUSTOMER' ? preferredLanguage : undefined,
      lat: role === 'CUSTOMER' ? 19.1197 : 28.6139, // Default coordinates
      lng: role === 'CUSTOMER' ? 72.8464 : 77.2090,
      device_fingerprint: 'win_chrome_pc_901',
      ip_address: '127.0.0.1'
    } : {
      phone,
      password,
      device_fingerprint: 'win_chrome_pc_901',
      ip_address: '127.0.0.1'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      // Fetch profile info
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        onLoginSuccess(meData.user, meData.profileId);
      } else {
        onLoginSuccess(data.user, '');
      }

    } catch (err: any) {
      setErrorText(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Group skills by category
  const groupedSkills = skillsTaxonomy.reduce((acc, curr) => {
    if (!acc[curr.category]) {
      acc[curr.category] = [];
    }
    acc[curr.category].push(curr.name);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div style={{ maxWidth: '420px', margin: '60px auto', padding: '0 16px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '4px', backgroundColor: '#0f766e', color: '#ffffff', marginBottom: '12px' }}>
          <Shield size={32} />
        </div>
        <h2 style={{ fontSize: '20px', color: '#1e293b', fontWeight: 'bold', textTransform: 'uppercase' }}>LABOURLINK TRUST INFRA</h2>
        <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
          Unified Authentication and Registry Portal
        </p>
      </div>

      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        
        {/* Role Tabs */}
        <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
          {(['WORKER', 'CUSTOMER', 'CONTRACTOR', 'ADMIN'] as const).map((r) => {
            const isActive = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  if (r === 'ADMIN') {
                    setIsRegister(false);
                  }
                  window.history.pushState({}, '', `/auth/${r.toLowerCase()}`);
                }}
                style={{
                  flex: 1,
                  padding: '10px 2px',
                  border: 'none',
                  backgroundColor: isActive ? '#0F766E' : '#f8fafc',
                  color: isActive ? '#ffffff' : '#475569',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {r}
              </button>
            );
          })}
        </div>

        {/* Auth Mode Tabs (Same component style) */}
        {role !== 'ADMIN' && (
          <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => { setIsRegister(false); setErrorText(null); }}
              style={{
                flex: 1,
                padding: '10px 4px',
                border: 'none',
                backgroundColor: !isRegister ? '#0F766E' : '#f8fafc',
                color: !isRegister ? '#ffffff' : '#475569',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setErrorText(null); }}
              style={{
                flex: 1,
                padding: '10px 4px',
                border: 'none',
                backgroundColor: isRegister ? '#0F766E' : '#f8fafc',
                color: isRegister ? '#ffffff' : '#475569',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              Register
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold', fontSize: '13px' }}>Full Name (पूरा नाम)</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name as per Aadhaar"
                  required
                />
              </div>

              {role === 'CONTRACTOR' && (
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '13px' }}>Company Name (फर्म का नाम)</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter contractor company name"
                    required
                  />
                </div>
              )}

              {role === 'CUSTOMER' && (
                <>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 'bold', fontSize: '13px' }}>Home Address (घर का पता)</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={homeAddress}
                      onChange={(e) => setHomeAddress(e.target.value)}
                      placeholder="Enter residential address"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 'bold', fontSize: '13px' }}>Preferred Language (पसंदीदा भाषा)</label>
                    <select 
                      className="form-control"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="hi">Hindi (हिंदी)</option>
                      <option value="mr">Marathi (मराठी)</option>
                      <option value="ta">Tamil (தமிழ்)</option>
                      <option value="te">Telugu (తెలుగు)</option>
                      <option value="bn">Bengali (বাংলা)</option>
                    </select>
                  </div>
                </>
              )}

              {role === 'WORKER' && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                    Select Your Skills (अपने हुनर चुनें)
                  </label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '4px' }}>
                    {Object.entries(groupedSkills).map(([cat, names]) => (
                      <div key={cat} style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9', paddingBottom: '2px' }}>
                          {cat}
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          {names.map(name => {
                            const isChecked = selectedSkills.includes(name);
                            return (
                              <label key={name} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedSkills(selectedSkills.filter(s => s !== name));
                                    } else {
                                      setSelectedSkills([...selectedSkills, name]);
                                    }
                                  }}
                                  style={{ marginRight: '6px' }}
                                />
                                {name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 'bold', fontSize: '13px' }}>Email Address (वैकल्पिक)</label>
                <input 
                  type="email" 
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 'bold', fontSize: '13px' }}>Phone Number (मोबाइल नंबर)</label>
            <div style={{ position: 'relative' }}>
              <Phone size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
              <input 
                type="tel" 
                className="form-control"
                style={{ paddingLeft: '32px' }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 'bold', fontSize: '13px' }}>Password (पासवर्ड)</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
              <input 
                type="password" 
                className="form-control"
                style={{ paddingLeft: '32px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter account password"
                required
              />
            </div>
            {!isRegister && (
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'block' }}>
                * Password for seeded test profiles is: <strong>password123</strong>
              </span>
            )}
          </div>

          {errorText && (
            <div style={{ padding: '10px', backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '4px', color: '#b91c1c', fontSize: '12px', marginBottom: '16px' }}>
              {errorText}
            </div>
          )}

          <button 
            type="submit" 
            style={{ width: '100%', padding: '10px', backgroundColor: '#0f766e', color: '#ffffff', border: 'none', fontWeight: 'bold', fontSize: '13px', borderRadius: '4px', cursor: 'pointer' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : (isRegister ? 'Register & Verify Identity' : 'Secure Login')}
          </button>
        </form>

        <div style={{ marginTop: '20px', borderTop: '1px dashed #cbd5e1', paddingTop: '16px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
          <span>🔒 Verified National Worker Registry Session</span>
        </div>
      </div>
    </div>
  );
};
export default Login;
