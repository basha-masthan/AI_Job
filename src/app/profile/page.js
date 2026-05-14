'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function UserProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error);
        setProfile(data.profile);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">👤 My Profile</h1>
              <p className="page-subtitle">Manage your account and integration settings</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
            <span className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : error ? (
          <div className="alert alert-danger">Error loading profile: {error}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
            
            <div className="card">
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>🛡️</span> Account Details
              </h2>
              
              <div className="grid-2">
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Full Name</div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{profile.name}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Email Address</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)' }}>{profile.email}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Account Status</div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`tag ${profile.verified ? 'tag-green' : 'tag-amber'}`}>
                      {profile.verified ? '✅ Verified' : '⏳ Pending Verification'}
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Member Since</div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ borderLeft: profile.nylasGrantId ? '4px solid var(--accent-emerald)' : '4px solid var(--accent-amber)' }}>
              <div className="flex-between" style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>✉️</span> Email Integration
                </h2>
                {profile.nylasGrantId ? (
                  <span className="tag tag-green">Connected</span>
                ) : (
                  <span className="tag tag-amber">Not Connected</span>
                )}
              </div>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
                Connect your Gmail to enable the AI Job Tracking Engine. This allows the system to automatically scan for job application updates, interview invites, and rejection emails.
              </p>

              {profile.nylasGrantId ? (
                <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Connected Account</div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{profile.nylasEmail || 'Email verified and active'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Last AI Sync</div>
                      <div style={{ fontSize: 13, color: 'var(--accent-primary)' }}>
                        {profile.lastEmailSyncTime ? new Date(profile.lastEmailSyncTime).toLocaleString() : 'Never synced'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <a href="/api/nylas/auth" className="btn btn-primary" style={{ background: '#ea4335', borderColor: '#ea4335', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 12.713l11.985-8.713h-23.97l11.985 8.713zm0 2.574l-12-8.727v11.44h24v-11.44l-12 8.727z"/></svg>
                  Connect Gmail Account
                </a>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
