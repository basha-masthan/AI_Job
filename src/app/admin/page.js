'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(d => {
        if (!d.success) throw new Error(d.error);
        setData(d);
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
              <h1 className="page-title">👑 FBT Control Center</h1>
              <p className="page-subtitle">Global Platform Metrics & User Management</p>
            </div>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              🔄 Refresh Data
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
            <span className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        ) : error ? (
          <div className="alert alert-danger">Error loading admin data: {error}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
              <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Total Users</div>
                <div style={{ fontSize: 32, fontWeight: 700, margin: '8px 0' }}>{data.stats.totalUsers}</div>
                <div style={{ fontSize: 12, color: 'var(--accent-emerald)' }}>{data.stats.verifiedUsers} Verified</div>
              </div>
              
              <div className="card" style={{ borderLeft: '4px solid var(--accent-amber)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Nylas Active Connections</div>
                <div style={{ fontSize: 32, fontWeight: 700, margin: '8px 0' }}>{data.stats.nylasConnected}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Users syncing emails</div>
              </div>

              <div className="card" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Resumes Generated</div>
                <div style={{ fontSize: 32, fontWeight: 700, margin: '8px 0' }}>{data.stats.totalResumes}</div>
                <div style={{ fontSize: 12, color: 'var(--accent-cyan)' }}>{data.stats.aiGeneratedResumes} by AI Engine</div>
              </div>

              <div className="card" style={{ borderLeft: '4px solid var(--accent-emerald)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Jobs Tracked</div>
                <div style={{ fontSize: 32, fontWeight: 700, margin: '8px 0' }}>{data.stats.totalJobs}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {data.stats.jobsInterview} Interviews • {data.stats.jobsOffer} Offers
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="card">
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Registered Users</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Email</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Nylas Connection</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Last Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{u.email}</td>
                        <td style={{ padding: '16px' }}>
                          <span className={`tag ${u.verified ? 'tag-green' : 'tag-amber'}`}>
                            {u.verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          {u.nylasGrantId ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--accent-emerald)' }}>●</span> Connected
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.nylasEmail}</div>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-muted)' }}>Not Connected</div>
                          )}
                        </td>
                        <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 12 }}>
                          {u.lastEmailSyncTime ? new Date(u.lastEmailSyncTime).toLocaleString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
