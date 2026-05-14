'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

const STATUS_COLORS = {
  wishlist: 'tag-purple',
  applied: 'tag-primary',
  interview: 'tag-cyan',
  offer: 'tag-green',
  rejected: 'tag-rose',
};

const QUICK_ACTIONS = [
  { href: '/resume-builder', icon: '✨', label: 'Build Tailored Resume', desc: 'AI-powered from JD', color: 'var(--accent-primary)' },
  { href: '/resume-vault', icon: '🔍', label: 'Match Resume to JD', desc: 'Find best fit from vault', color: 'var(--accent-cyan)' },
  { href: '/job-fetcher', icon: '🔗', label: 'Fetch Job Details', desc: 'Paste any job URL', color: 'var(--accent-emerald)' },
  { href: '/job-tracker', icon: '📋', label: 'Track Applications', desc: 'Kanban job board', color: 'var(--accent-amber)' },
];

export default function Dashboard() {
  const [stats, setStats] = useState({ resumes: 0, jobs: 0, applied: 0, interviews: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/resumes').then(r => r.json()),
      fetch('/api/jobs').then(r => r.json()),
    ]).then(([rData, jData]) => {
      const jobs = jData.jobs || [];
      setStats({
        resumes: (rData.resumes || []).length,
        jobs: jobs.length,
        applied: jobs.filter(j => j.status === 'applied').length,
        interviews: jobs.filter(j => j.status === 'interview').length,
      });
      setRecentJobs(jobs.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Resumes', value: stats.resumes, icon: '📄', color: 'rgba(99,102,241,0.15)', iconColor: 'var(--accent-primary)' },
    { label: 'Jobs Tracked', value: stats.jobs, icon: '💼', color: 'rgba(6,182,212,0.15)', iconColor: 'var(--accent-cyan)' },
    { label: 'Applied', value: stats.applied, icon: '📨', color: 'rgba(16,185,129,0.15)', iconColor: 'var(--accent-emerald)' },
    { label: 'Interviews', value: stats.interviews, icon: '🎯', color: 'rgba(245,158,11,0.15)', iconColor: 'var(--accent-amber)' },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="hero-glow" />

        {/* Header */}
        <div className="page-header">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <div>
              <h1 className="page-title">Good {getGreeting()} 👋</h1>
              <p className="page-subtitle">Your AI-powered career command center</p>
            </div>
            <div className="flex-row">
              <Link href="/resume-builder" className="btn btn-primary">
                ✨ New Resume
              </Link>
              <Link href="/job-fetcher" className="btn btn-secondary">
                🔗 Fetch Job
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          {statCards.map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.color }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
              </div>
              <div>
                <div className="stat-value">{loading ? '—' : s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ gap: 24 }}>
          {/* Quick Actions */}
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, fontFamily: 'Space Grotesk' }}>⚡ Quick Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {QUICK_ACTIONS.map(a => (
                <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                  <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: `${a.color}20`,
                      border: `1px solid ${a.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, flexShrink: 0,
                    }}>{a.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{a.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.desc}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 16 }}>→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Jobs */}
          <div>
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk' }}>🕐 Recent Applications</h2>
              <Link href="/job-tracker" className="btn btn-ghost btn-sm">View All →</Link>
            </div>
            {loading ? (
              <div className="empty-state"><div className="spinner spinner-lg" /></div>
            ) : recentJobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div className="empty-title">No jobs tracked yet</div>
                <div className="empty-desc">Start by fetching a job URL or adding one manually</div>
                <Link href="/job-fetcher" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Fetch a Job</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentJobs.map(job => (
                  <div key={job.id} className="card" style={{ padding: 16 }}>
                    <div className="flex-between" style={{ marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{job.title || 'Untitled Role'}</div>
                      <span className={`tag ${STATUS_COLORS[job.status] || 'tag-primary'}`}>{job.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {job.company || 'Unknown Company'} · {job.location || 'Remote'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Features Banner */}
        <div style={{ marginTop: 32 }} className="card-glass">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                🤖 Powered by Claude on AWS Bedrock
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Generate ATS-optimized resumes tailored to any job description, match existing resumes, and extract structured data from any job posting URL — all with state-of-the-art AI.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {['ATS-Optimized', 'Resume Vault', 'URL Scraper', 'Job Tracker'].map(f => (
                <span key={f} className="tag tag-primary" style={{ padding: '6px 14px', fontSize: 12 }}>{f}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
