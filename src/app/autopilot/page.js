'use client';
import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

const STATUS_BADGE = {
  pending: { label: 'Pending', color: 'var(--text-muted)', bg: 'transparent' },
  matched: { label: 'Matched', color: '#3b82f6', bg: '#3b82f620' },
  prepared: { label: 'Ready', color: '#8b5cf6', bg: '#8b5cf620' },
  applied: { label: 'Applied', color: '#10b981', bg: '#10b98120' },
  failed: { label: 'Failed', color: '#ef4444', bg: '#ef444420' },
};

const LOG_CATEGORIES = {
  search: { label: 'Search', icon: '🔍', color: '#3b82f6' },
  match: { label: 'Match', icon: '🎯', color: '#8b5cf6' },
  prepare: { label: 'Tailor', icon: '✨', color: '#f59e0b' },
  apply: { label: 'Apply', icon: '📨', color: '#10b981' },
  system: { label: 'System', icon: '⚙️', color: '#64748b' },
  error: { label: 'Error', icon: '⚠️', color: '#ef4444' },
};

function categorizeLog(log) {
  const title = (log.title || '').toLowerCase();
  const message = (log.message || '').toLowerCase();
  if (log.type === 'error') return 'error';
  if (title.includes('search') || title.includes('found')) return 'search';
  if (title.includes('match') || title.includes('score')) return 'match';
  if (title.includes('prepar') || title.includes('tailor') || title.includes('cover')) return 'prepare';
  if (title.includes('sent') || title.includes('appli') || title.includes('sending')) return 'apply';
  return 'system';
}

function relativeTime(isoTime) {
  const t = new Date(isoTime).getTime();
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function AutopilotPage() {
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [dailyCap, setDailyCap] = useState(50);
  const [loading, setLoading] = useState(false);
  const [autopilot, setAutopilot] = useState({ active: false, logs: [] });
  const [activeRun, setActiveRun] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedJob, setExpandedJob] = useState(null);

  useEffect(() => {
    fetch('/api/resumes')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.resumes?.length > 0) {
          setResumes(d.resumes);
          const fav = d.resumes.find(r => r.isFavorite);
          setSelectedResumeId(fav?.id || d.resumes[0].id);
        }
      });

    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/autopilot/status');
      const data = await res.json();
      if (data.success) {
        setAutopilot(data.state || { active: false, logs: [] });
        setActiveRun(data.activeRun);
        setRecentRuns(data.recentRuns || []);
      }
    } catch {}
  }

  async function handleStart(e) {
    e.preventDefault();
    if (!jobTitle.trim() || !selectedResumeId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/autopilot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, location, resumeId: selectedResumeId, dailyCap }),
      });
      const data = await res.json();
      if (data.success) {
        setAutopilot(data.state);
        await fetchStatus();
      } else {
        alert('Error: ' + data.error);
      }
    } catch { alert('Failed to start Autopilot'); }
    finally { setLoading(false); }
  }

  async function handleStop() {
    if (!confirm('Stop the autopilot pipeline?')) return;
    try {
      const res = await fetch('/api/autopilot/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) { setAutopilot(data.state); setActiveRun(null); await fetchStatus(); }
    } catch { alert('Failed to stop'); }
  }

  async function handlePause() {
    try {
      await fetch('/api/autopilot/pause', { method: 'POST' });
      await fetchStatus();
    } catch { alert('Failed to pause'); }
  }

  async function handleResume() {
    try {
      await fetch('/api/autopilot/resume', { method: 'POST' });
      await fetchStatus();
    } catch { alert('Failed to resume'); }
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/autopilot/history');
      const data = await res.json();
      if (data.success) setHistory(data.runs);
      setShowHistory(!showHistory);
    } catch {}
  }

  const isRunning = autopilot.active || activeRun?.status === 'running';
  const isPaused = activeRun?.status === 'paused';
  const stats = activeRun?.stats || { searched: 0, matched: 0, prepared: 0, applied: 0, failed: 0 };
  const jobs = activeRun?.jobs || [];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <div>
              <h1 className="page-title">Auto Apply <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--accent-primary)', background: 'var(--accent-primary)15', padding: '2px 10px', borderRadius: 20, marginLeft: 8, verticalAlign: 'middle', letterSpacing: 0 }}>Autopilot</span></h1>
              <p className="page-subtitle">End-to-end automated job search, matching, and application pipeline.</p>
            </div>
            <div className="flex-row" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={loadHistory}>
                {showHistory ? 'Hide History' : '📋 History'}
              </button>
              <Link href="/jobs-applied" className="btn btn-secondary btn-sm">
                📨 Applied Jobs
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        {activeRun && (
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Searched', value: stats.searched, icon: '🔍', color: '#3b82f6' },
              { label: 'Matched', value: stats.matched, icon: '🎯', color: '#8b5cf6' },
              { label: 'Prepared', value: stats.prepared, icon: '✨', color: '#f59e0b' },
              { label: 'Applied', value: stats.applied, icon: '📨', color: '#10b981' },
              { label: 'Failed', value: stats.failed, icon: '❌', color: '#ef4444' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ borderLeft: `3px solid ${s.color}` }}>
                <div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{s.icon}</span> {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid-2" style={{ gap: 24 }}>
          {/* ── LEFT: Configuration ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {showHistory ? (
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📋 Autopilot History</h3>
                {history.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No previous runs found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.map(run => (
                      <div key={run.id} className="card" style={{ padding: 14, fontSize: 13 }}>
                        <div className="flex-between">
                          <div>
                            <strong>{run.targetRole}</strong>
                            {run.targetLocation && <span style={{ color: 'var(--text-muted)' }}> · {run.targetLocation}</span>}
                          </div>
                          <span className={`tag ${run.status === 'running' ? 'tag-green' : run.status === 'completed' ? 'tag-primary' : 'tag-rose'}`}>{run.status}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(run.startedAt).toLocaleDateString()} · Applied: {run.appliedJobs}/{run.totalJobs} · Failed: {run.failedJobs}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card">
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚙️ Configuration
                </h2>
                <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Target Role *</label>
                    <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                      placeholder="e.g. Full Stack Developer" className="form-input" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Target Location</label>
                    <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. Remote, Bangalore, India" className="form-input" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Resume (Vault)</label>
                    <select value={selectedResumeId} onChange={e => setSelectedResumeId(e.target.value)}
                      className="form-input" required>
                      <option value="" disabled>Select a resume...</option>
                      {resumes.map(r => (
                        <option key={r.id} value={r.id}>{r.data?.name || r.fileName || 'Resume'} {r.isFavorite ? '⭐' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Daily Cap (max applications)</label>
                    <input type="number" min={1} max={100} value={dailyCap}
                      onChange={e => setDailyCap(parseInt(e.target.value) || 50)} className="form-input" />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      ⚡ Runs continuously with 30s pause between each application
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={loading || isRunning || isPaused}
                      className="btn btn-primary" style={{ flex: 1, padding: 14, fontSize: 15 }}>
                      {loading ? 'Starting...' : isRunning ? '🟢 Running' : isPaused ? '⏸️ Paused' : '🚀 Start Autopilot'}
                    </button>
                    {isRunning && <button type="button" onClick={handlePause}
                      className="btn btn-secondary">⏸️ Pause</button>}
                    {isPaused && <button type="button" onClick={handleResume}
                      className="btn btn-primary">▶️ Resume</button>}
                    {(isRunning || isPaused) && <button type="button" onClick={handleStop}
                      className="btn btn-secondary" style={{ background: '#ef444420', color: '#ef4444', borderColor: '#ef444440' }}>⏹️ Stop</button>}
                  </div>
                </form>
              </div>
            )}

            {/* ── Job Queue ── */}
            {activeRun && jobs.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                  📋 Jobs Pipeline ({jobs.length})
                </h3>
                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {jobs.slice(0, 30).map(job => {
                    const badge = STATUS_BADGE[job.status] || STATUS_BADGE.pending;
                    return (
                      <div key={job.id} style={{
                        fontSize: 12, padding: '8px 10px', borderRadius: 6,
                        background: 'var(--bg-secondary)', cursor: 'pointer',
                        borderLeft: `3px solid ${badge.color}`,
                      }} onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>
                        <div className="flex-between" style={{ marginBottom: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{job.title?.substring(0, 35)}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: badge.bg, color: badge.color, fontWeight: 600 }}>
                            {badge.label}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {job.company} · Score: {job.score}%
                        </div>
                        {expandedJob === job.id && (
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                            <div>📍 {job.location}</div>
                            {job.matchReason && <div>💡 {job.matchReason}</div>}
                            {job.error && <div style={{ color: '#ef4444' }}>❌ {job.error}</div>}
                            {job.appliedAt && <div>✅ Applied: {new Date(job.appliedAt).toLocaleTimeString()}</div>}
                            {job.appliedEmail && <div>📧 {job.appliedEmail}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Organized Recent Activity ── */}
          <div className="card" style={{ background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column' }}>
            {autopilot.logs.length > 0 ? <OrganizedActivity
              logs={autopilot.logs}
              isRunning={isRunning}
              isPaused={isPaused}
              onClear={async () => {
                await fetch('/api/autopilot/clear-logs', { method: 'POST' });
                setAutopilot({ active: false, logs: [] });
              }}
            /> : <HowItWorksEmpty />}
          </div>
        </div>
      </main>
    </div>
  );
}

function OrganizedActivity({ logs, isRunning, isPaused, onClear }) {
  const [filter, setFilter] = useState('all');
  const [expandedLog, setExpandedLog] = useState(null);

  const grouped = useMemo(() => {
    const groups = { search: [], match: [], prepare: [], apply: [], system: [], error: [] };
    logs.forEach(log => {
      const cat = categorizeLog(log);
      if (groups[cat]) groups[cat].push(log);
    });
    return groups;
  }, [logs]);

  const counts = {
    search: grouped.search.length,
    match: grouped.match.length,
    prepare: grouped.prepare.length,
    apply: grouped.apply.length,
    error: grouped.error.length,
  };

  const filters = [
    { id: 'all', label: 'All', count: logs.length, color: 'var(--text-primary)' },
    { id: 'search', label: 'Search', count: counts.search, color: LOG_CATEGORIES.search.color },
    { id: 'match', label: 'Match', count: counts.match, color: LOG_CATEGORIES.match.color },
    { id: 'prepare', label: 'Tailor', count: counts.prepare, color: LOG_CATEGORIES.prepare.color },
    { id: 'apply', label: 'Apply', count: counts.apply, color: LOG_CATEGORIES.apply.color },
    ...(counts.error > 0 ? [{ id: 'error', label: 'Errors', count: counts.error, color: LOG_CATEGORIES.error.color }] : []),
  ];

  const visibleLogs = filter === 'all'
    ? logs
    : grouped[filter] || [];

  const latestByCategory = {};
  logs.forEach(log => {
    const cat = categorizeLog(log);
    if (!latestByCategory[cat]) latestByCategory[cat] = log;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isRunning ? '#10b981' : isPaused ? '#f59e0b' : '#64748b' }}></span>
          {isRunning ? 'Live Progress' : isPaused ? 'Paused' : 'Recent Activity'}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{logs.length} events</span>
          <button onClick={onClear} style={{
            padding: '2px 8px', fontSize: 10, borderRadius: 4,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontWeight: 500, lineHeight: '20px',
          }} title="Clear recent activity">🗑️ Clear</button>
        </div>
      </div>

      {/* Pipeline Summary Chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
        {Object.entries(LOG_CATEGORIES).filter(([k]) => k !== 'system').map(([key, cat]) => {
          const latest = latestByCategory[key];
          return (
            <div key={key} style={{
              padding: '8px 4px', textAlign: 'center', borderRadius: 6,
              background: `${cat.color}10`, border: `1px solid ${cat.color}30`,
            }} title={latest ? `${latest.title}: ${latest.message}` : `No ${cat.label.toLowerCase()} activity yet`}>
              <div style={{ fontSize: 14, marginBottom: 2 }}>{cat.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: cat.color }}>{counts[key] || 0}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{cat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
              border: '1px solid var(--border)',
              background: filter === f.id ? `${f.color}20` : 'transparent',
              color: filter === f.id ? f.color : 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              borderColor: filter === f.id ? `${f.color}50` : 'var(--border)',
            }}
          >
            {f.label}
            <span style={{
              fontSize: 10, padding: '0 5px', borderRadius: 8,
              background: filter === f.id ? `${f.color}30` : 'var(--bg-card)',
            }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Log List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
        {visibleLogs.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No events in this category yet.
          </div>
        ) : (
          visibleLogs.map((log, i) => {
            const cat = categorizeLog(log);
            const catInfo = LOG_CATEGORIES[cat];
            const isExpanded = expandedLog === i;
            const isSuccess = log.type === 'success';
            const isError = log.type === 'error';
            return (
              <div
                key={i}
                onClick={() => setExpandedLog(isExpanded ? null : i)}
                style={{
                  padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 8,
                  borderLeft: `3px solid ${isError ? catInfo.color : isSuccess ? '#10b981' : catInfo.color}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: `${catInfo.color}20`, color: catInfo.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {catInfo.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>
                      {log.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {relativeTime(log.time)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-secondary)', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: isExpanded ? 10 : 2, WebkitBoxOrient: 'vertical',
                    lineHeight: 1.4,
                  }}>
                    {log.message}
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)' }}>
                      🕒 {new Date(log.time).toLocaleString()} · 📂 {catInfo.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function HowItWorksEmpty() {
  return (
    <>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        📖 How it Works
      </h3>
      <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
        {[
          { n: 1, t: 'Smart Search', d: '8 job sources — LinkedIn, Indeed, Naukri, etc.' },
          { n: 2, t: 'AI Match Scoring', d: 'Each job scored 0-100% against your resume.' },
          { n: 3, t: 'Resume Tailoring', d: 'AI personalizes resume for every matched job.' },
          { n: 4, t: 'Email Generation', d: 'Compelling, role-specific cover email.' },
          { n: 5, t: 'Auto-Apply', d: 'Sends via SMTP with PDF resume attached.' },
        ].map(s => (
          <li key={s.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: 'var(--accent-primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>{s.n}</div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{s.t}</div>
              <div style={{ fontSize: 11, lineHeight: 1.5 }}>{s.d}</div>
            </div>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16, padding: 12, background: '#3b82f615', borderRadius: 8, border: '1px solid #3b82f630' }}>
        <div style={{ fontWeight: 600, color: '#3b82f6', fontSize: 12, marginBottom: 4 }}>⚡ Persistent Engine</div>
        <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
          State saved after every step. Survives restarts. Daily caps prevent rate-limit issues.
        </p>
      </div>
    </>
  );
}
