'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

const JOB_STATUS_LABELS = {
  actively_looking: '🟢 Actively Looking',
  casually_looking: '🟡 Casually Looking',
  not_looking: '🔴 Not Looking',
  employed: '💼 Currently Employed',
  student: '🎓 Student / Fresher'
};

export default function UserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [jobStatus, setJobStatus] = useState('actively_looking');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error);
        setProfile(data.profile);
        setPhone(data.profile.phone || '');
        setAddress(data.profile.address || '');
        setEducation(data.profile.education || '');
        setExperience(data.profile.experience || '');
        setJobStatus(data.profile.jobStatus || 'actively_looking');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveChanges = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, address, education, experience, jobStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save changes');
      
      setProfile(data.profile);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="hero-glow" style={{ top: '-10%', right: '5%', opacity: 0.15 }} />
        
        <div className="page-header">
          <h1 className="page-title">👤 My Profile</h1>
          <p className="page-subtitle">Manage your personal professional card, account settings, and API integrations</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
            <span className="spinner spinner-lg" style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: 'var(--accent-primary)' }} />
          </div>
        ) : error ? (
          <div className="alert alert-error" style={{ maxWidth: 800, marginBottom: 20 }}>⚠️ {error}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 800, paddingBottom: 80 }}>
            
            {saveSuccess && (
              <div className="alert alert-success" style={{
                animation: 'pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                boxShadow: '0 4px 20px rgba(16,185,129,0.15)'
              }}>
                ✨ Profile changes saved successfully to your database!
              </div>
            )}

            {/* 🛡️ Account Details Card */}
            <div className="card" style={{ padding: 32, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, right: 0, width: '150px', height: '150px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 24,
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                  display: 'flex', alignItems: 'center', justifycontent: 'center',
                  fontSize: 32, fontWeight: 700, color: '#fff',
                  boxShadow: '0 8px 30px rgba(99,102,241,0.3), inset 0 2px 2px rgba(255,255,255,0.2)',
                  flexShrink: 0, textShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  {getInitials(profile.name)}
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: 'Space Grotesk' }}>{profile.name}</h2>
                    <span className={`tag ${profile.verified ? 'tag-green' : 'tag-amber'}`}>
                      {profile.verified ? '✅ Verified Profile' : '⏳ Pending Verification'}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>{profile.email}</p>
                </div>
              </div>

              <div className="divider" style={{ margin: '24px 0' }} />

              <div className="grid-2" style={{ gap: 20 }}>
                <div className="card-glass" style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.01)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Account Role</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🔑 Candidate / Job Seeker
                  </div>
                </div>
                <div className="card-glass" style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.01)' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Member Since</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                    📅 {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            {/* 💼 Professional Details Card */}
            <div className="card" style={{ padding: 32, position: 'relative' }}>
              <div className="flex-between" style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>💼</span> Professional Profile Details
                </h3>
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    ✏️ Edit Profile
                  </button>
                ) : (
                  <button onClick={() => setIsEditing(false)} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}>
                    Cancel
                  </button>
                )}
              </div>

              {isEditing ? (
                /* Edit Mode Form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div className="grid-2" style={{ gap: 20 }}>
                    <div className="form-group">
                      <label className="form-label">📞 Mobile Number</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="+91 9876543210"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">📍 Current Address</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="City, State, Country"
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">🎓 Educational Background</label>
                    <textarea
                      className="form-textarea"
                      rows="2"
                      placeholder="E.g., B.Tech in Computer Science from University XYZ (2020-2024)"
                      value={education}
                      onChange={e => setEducation(e.target.value)}
                      style={{ minHeight: 70 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">🛠️ Internship / Experience Details</label>
                    <textarea
                      className="form-textarea"
                      rows="3"
                      placeholder="Describe your previous internships, roles, and major responsibilities..."
                      value={experience}
                      onChange={e => setExperience(e.target.value)}
                      style={{ minHeight: 90 }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">🎯 Current Job Status</label>
                    <select
                      className="form-select"
                      value={jobStatus}
                      onChange={e => setJobStatus(e.target.value)}
                    >
                      <option value="actively_looking">🟢 Actively Looking</option>
                      <option value="casually_looking">🟡 Casually Looking</option>
                      <option value="not_looking">🔴 Not Looking</option>
                      <option value="employed">💼 Currently Employed</option>
                      <option value="student">🎓 Student / Fresher</option>
                    </select>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button onClick={() => setIsEditing(false)} className="btn btn-ghost" disabled={saving}>
                      Discard
                    </button>
                    <button onClick={handleSaveChanges} className="btn btn-primary" disabled={saving} style={{ minWidth: 140 }}>
                      {saving ? <><span className="spinner" /> Saving...</> : '💾 Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode Display */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div className="grid-2" style={{ gap: 20 }}>
                    <div className="card-glass" style={{ padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.02)', background: 'rgba(255,255,255,0.01)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>📞 Phone Number</div>
                      <div style={{ fontSize: 14, color: phone ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}>
                        {phone || 'Not provided yet'}
                      </div>
                    </div>

                    <div className="card-glass" style={{ padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.02)', background: 'rgba(255,255,255,0.01)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>📍 Current Location</div>
                      <div style={{ fontSize: 14, color: address ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500 }}>
                        {address || 'Not provided yet'}
                      </div>
                    </div>
                  </div>

                  <div className="card-glass" style={{ padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.02)', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>🎓 Educational History</div>
                    <div style={{ fontSize: 14, color: education ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {education || 'Describe your major, college/school details to stand out to employers.'}
                    </div>
                  </div>

                  <div className="card-glass" style={{ padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.02)', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>🛠️ Experience & Internships</div>
                    <div style={{ fontSize: 14, color: experience ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {experience || 'Share your past internships, side projects, or active volunteer contributions.'}
                    </div>
                  </div>

                  <div className="card-glass" style={{ padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.02)', background: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 4 }}>🎯 Active Job Status</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {JOB_STATUS_LABELS[jobStatus] || JOB_STATUS_LABELS.actively_looking}
                      </div>
                    </div>
                    <button onClick={() => setIsEditing(true)} className="btn btn-secondary btn-sm">
                      Change Status
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ✉️ Google Integration Card */}
            <div className="card" style={{ padding: 32, borderLeft: profile.googleRefreshToken ? '4px solid var(--accent-emerald)' : '4px solid var(--accent-amber)', position: 'relative' }}>
              <div className="flex-between" style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Space Grotesk' }}>
                  <span>✉️</span> Google Gmail Integration
                </h2>
                {profile.googleRefreshToken ? (
                  <span className="tag tag-green" style={{ boxShadow: '0 0 15px rgba(16,185,129,0.15)' }}>Connected</span>
                ) : (
                  <span className="tag tag-amber" style={{ boxShadow: '0 0 15px rgba(245,158,11,0.1)' }}>Not Connected</span>
                )}
              </div>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Securely connect your Gmail account via direct Google API to activate real-time Job application updates tracking, automatic status matches, rejection/acceptance filters, and smart calendar invites!
              </p>

              {profile.googleRefreshToken ? (
                <div style={{ background: 'var(--bg-secondary)', padding: '20px 24px', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Sync Status</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-emerald)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>●</span> Direct Google API Live
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Last AI Scanning sweep</div>
                      <div style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 500, marginTop: 4 }}>
                        {profile.lastGoogleSyncTime ? new Date(profile.lastGoogleSyncTime).toLocaleString() : 'Just initialized'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <a href="/api/google/auth" className="btn btn-primary" style={{ background: '#ea4335', borderColor: '#ea4335', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.3.65 4.5 1.8l2.4-2.4C17.3 1.7 14.9.9 12.24.9c-5.5 0-10 4.5-10 10s4.5 10 10 10c5.5 0 9.7-3.9 9.7-9.7 0-.6-.1-1.2-.2-1.8H12.24z"/></svg>
                  Connect Google Account
                </a>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
