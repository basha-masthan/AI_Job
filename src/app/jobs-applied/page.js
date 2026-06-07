'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default function JobsAppliedPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = () => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.jobs) {
          const appliedJobs = d.jobs.filter(j => j.status === 'applied');
          appliedJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setJobs(appliedJobs);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchJobs();
    // Poll every 30s for email open status updates
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, []);

  function EmailStatus({ job }) {
    if (job.emailOpened) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: '20px',
            background: '#10b98118', color: '#10b981',
            fontWeight: 600, border: '1px solid #10b98130'
          }}>
            👁️ Opened {job.emailOpenCount > 1 ? `${job.emailOpenCount}x` : ''}
          </span>
          {job.emailOpenedAt && (
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              {new Date(job.emailOpenedAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
              })}
            </span>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 10px', borderRadius: '20px',
          background: '#64748b18', color: '#64748b',
          fontWeight: 600, border: '1px solid #64748b30'
        }}>
          📤 Sent – Awaiting Open
        </span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <div>
              <h1 className="page-title">📨 Jobs Applied</h1>
              <p className="page-subtitle">Track your automated applications. Email open status updates every 30s.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={fetchJobs}>🔄 Refresh</button>
              <Link href="/auto-apply" className="btn btn-primary">🚀 Auto Apply</Link>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {jobs.length > 0 && (
          <div style={{
            display: 'flex', gap: '16px', marginTop: '16px', padding: '16px',
            background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)'
          }}>
            {[
              { label: 'Total Applied', value: jobs.length, color: '#3b82f6', icon: '📨' },
              { label: 'Email Opened', value: jobs.filter(j => j.emailOpened).length, color: '#10b981', icon: '👁️' },
              { label: 'Awaiting', value: jobs.filter(j => !j.emailOpened).length, color: '#f59e0b', icon: '⏳' },
              { label: 'Auto-Applied', value: jobs.filter(j => j.source === 'auto-apply').length, color: '#8b5cf6', icon: '🤖' },
            ].map(stat => (
              <div key={stat.label} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: stat.color }}>{stat.icon} {stat.value}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
              <div className="spinner spinner-xl" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-title">No applications yet</div>
              <div className="empty-desc">Start the Autopilot to automate your job search, or track them manually.</div>
              <Link href="/auto-apply" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Go to Auto Apply</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {jobs.map(job => (
                <div key={job.id} className="card" style={{
                  display: 'flex', gap: '20px', alignItems: 'flex-start',
                  borderLeft: job.emailOpened ? '3px solid #10b981' : '3px solid var(--border)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div className="flex-between" style={{ marginBottom: 6 }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700 }}>{job.title || job.role || 'Unknown Role'}</h3>
                      <span className={`tag ${job.emailOpened ? 'tag-success' : 'tag-primary'}`}>
                        {job.emailOpened ? '👁️ Email Viewed' : 'Applied'}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      <span>🏢 {job.company || 'Unknown Company'}</span>
                      <span>📍 {job.location || 'Remote'}</span>
                      {job.appliedEmail && <span>✉️ {job.appliedEmail}</span>}
                    </div>

                    {/* Email read tracking */}
                    <EmailStatus job={job} />

                    {/* Source badge */}
                    {job.source === 'auto-apply' && (
                      <div style={{ marginTop: 8, fontSize: '12px', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="lp-badge-dot" style={{ background: '#8b5cf6' }}></span> Auto-Applied
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '100px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(job.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </span>
                    {job.url && job.url !== '#' && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        View Job
                      </a>
                    )}
                    {/* Show open count if re-opened */}
                    {job.emailOpenCount > 1 && (
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                        Opened {job.emailOpenCount}×
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
