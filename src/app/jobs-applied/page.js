'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default function JobsAppliedPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.jobs) {
          // Filter for autopilot/auto-applied or we can just show all applied
          const appliedJobs = d.jobs.filter(j => j.status === 'applied');
          // Sort by newest
          appliedJobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setJobs(appliedJobs);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <div>
              <h1 className="page-title">📨 Jobs Applied</h1>
              <p className="page-subtitle">Track your automated and manual job applications.</p>
            </div>
            <Link href="/autopilot" className="btn btn-primary">
              🚀 Configure Autopilot
            </Link>
          </div>
        </div>

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
              <Link href="/autopilot" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>Go to Autopilot</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {jobs.map(job => (
                <div key={job.id} className="card" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div className="flex-between" style={{ marginBottom: 8 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{job.title || job.role || 'Unknown Role'}</h3>
                      <span className="tag tag-primary">Applied</span>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', gap: '16px' }}>
                      <span>🏢 {job.company || 'Unknown Company'}</span>
                      <span>📍 {job.location || 'Remote'}</span>
                      {job.appliedEmail && <span>✉️ Sent to: {job.appliedEmail}</span>}
                    </div>
                    {job.source === 'autopilot' && (
                      <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="lp-badge-dot" style={{ background: '#10b981' }}></span> Auto-Applied via Autopilot
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(job.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => alert('Feature coming soon: View detailed email logs & tailored resume sent.')}>
                      View Details
                    </button>
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
