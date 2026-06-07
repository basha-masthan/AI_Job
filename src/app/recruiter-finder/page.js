'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';

const CONFIDENCE_COLORS = {
  high: 'var(--accent-emerald)',
  mid:  'var(--accent-amber)',
  low:  'var(--accent-rose)',
};

function confidenceLevel(c) {
  if (c >= 0.8) return 'high';
  if (c >= 0.5) return 'mid';
  return 'low';
}

function ConfidenceBadge({ value }) {
  const pct = Math.round((value || 0) * 100);
  const level = confidenceLevel(value || 0);
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: `${CONFIDENCE_COLORS[level]}22`,
      color: CONFIDENCE_COLORS[level], border: `1px solid ${CONFIDENCE_COLORS[level]}44`,
    }}>
      {pct}% match
    </span>
  );
}

function EmailBadge({ email, status }) {
  if (!email) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No email found</span>;
  const isValid = status !== 'invalid';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: isValid ? '#10b98122' : '#ef444422',
      color: isValid ? 'var(--accent-emerald)' : 'var(--accent-rose)',
      border: `1px solid ${isValid ? '#10b98144' : '#ef444444'}`,
    }}>
      {isValid ? '✅' : '❌'} {email}
    </span>
  );
}

export default function RecruiterFinderPage() {
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('Hyderabad, Bangalore');
  const [resumeId, setResumeId] = useState('');
  const [resumes, setResumes] = useState([]);
  const [autoApply, setAutoApply] = useState(false);

  const [status, setStatus] = useState('idle'); // idle | running | complete | error
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [applyingId, setApplyingId] = useState(null);
  const [appliedIds, setAppliedIds] = useState(new Set());

  const pollRef = useRef(null);

  const [userEmail, setUserEmail] = useState('kingkite789@gmail.com');

  // Load resumes
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.profile?.email) {
          setUserEmail(data.profile.email);
        }
      })
      .catch(console.error);

    fetch('/api/resumes').then(r => r.json()).then(d => {
      const list = d.resumes || [];
      setResumes(list);
      const fav = list.find(r => r.isFavorite);
      if (fav) setResumeId(fav.id);
      else if (list[0]) setResumeId(list[0].id);
    }).catch(() => {});
  }, []);

  // Poll for results when running
  useEffect(() => {
    if (status === 'running') {
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch('/api/autopilot/recruiter-search');
          const d = await r.json();
          setJobs(d.jobs || []);
          setLogs(d.logs || []);
          if (d.status !== 'running') {
            setStatus(d.status || 'complete');
            clearInterval(pollRef.current);
          }
        } catch {}
      }, 2000);
    }
    return () => clearInterval(pollRef.current);
  }, [status]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!role.trim()) return;
    setStatus('running');
    setJobs([]);
    setLogs([]);
    setAppliedIds(new Set());

    try {
      await fetch('/api/autopilot/recruiter-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role.trim(),
          location: location.trim(),
          resumeId,
          userId: userEmail,
          autoApply,
        }),
      });
    } catch (err) {
      setStatus('error');
      setLogs([{ msg: `Error: ${err.message}`, time: new Date().toISOString() }]);
    }
  }

  async function handleApply(job) {
    if (!job.email) { alert('No email found for this job. Cannot apply.'); return; }
    if (!resumeId) { alert('Please select a resume first.'); return; }
    setApplyingId(job.id);
    try {
      const res = await fetch('/api/autopilot/recruiter-search', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, resumeId, userId: userEmail }),
      });
      const d = await res.json();
      if (d.success) {
        setAppliedIds(prev => new Set([...prev, job.id]));
        alert(`✅ Applied to ${job.company} at ${job.email}!`);
      } else {
        alert('Failed: ' + d.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setApplyingId(null);
    }
  }

  const emailJobs = jobs.filter(j => j.email);
  const noEmailJobs = jobs.filter(j => !j.email);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">🕵️ Recruiter Post Finder</h1>
            <p className="page-subtitle">
              Hunts the open internet for recruiters who share email addresses publicly — less competition, direct contact
            </p>
          </div>
        </div>

        {/* How it works banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(16,185,129,0.08))',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24,
          display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
        }}>
          {[
            { icon: '🔍', label: 'Tavily Search', desc: 'Advanced web crawl' },
            { icon: '🤖', label: 'Jina AI', desc: 'Free page extraction' },
            { icon: '🧠', label: 'AI Extraction', desc: 'Nvidia Nemotron LLM' },
            { icon: '📧', label: 'Hunter.io Verify', desc: 'Email validation' },
            { icon: '📤', label: 'Direct Apply', desc: 'With resume + links' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>

          {/* ── LEFT: Search Config ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🎯 Search Configuration</h2>

              <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Target Role *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Full Stack Developer, React Engineer"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    required
                    disabled={status === 'running'}
                  />
                </div>

                <div>
                  <label className="form-label">Location</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Hyderabad, Bangalore, Remote"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    disabled={status === 'running'}
                  />
                </div>

                <div>
                  <label className="form-label">Resume to Send</label>
                  <select
                    className="form-input"
                    value={resumeId}
                    onChange={e => setResumeId(e.target.value)}
                    disabled={status === 'running'}
                  >
                    {resumes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.isFavorite ? '⭐ ' : ''}{r.fileName || r.data?.name || 'Resume'}
                      </option>
                    ))}
                  </select>
                </div>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '10px 14px', borderRadius: 8,
                  background: autoApply ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                  border: `1px solid ${autoApply ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
                }}>
                  <input
                    type="checkbox"
                    checked={autoApply}
                    onChange={e => setAutoApply(e.target.checked)}
                    disabled={status === 'running'}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>🤖 Auto-Apply Mode</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Automatically email all jobs with valid emails & confidence ≥ 60%
                    </div>
                  </div>
                </label>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '13px', fontSize: 15 }}
                  disabled={status === 'running' || !role.trim()}
                >
                  {status === 'running' ? (
                    <><span className="spinner" /> Searching the internet...</>
                  ) : '🔍 Find Recruiter Posts'}
                </button>
              </form>
            </div>

            {/* Live Log */}
            {logs.length > 0 && (
              <div className="card" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📡 Live Log</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {logs.map((l, i) => (
                    <div key={i} style={{
                      fontSize: 12, color: 'var(--text-secondary)',
                      padding: '4px 8px', borderRadius: 6,
                      background: 'var(--bg-secondary)',
                      borderLeft: '3px solid var(--accent-primary)',
                    }}>
                      {l.msg}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Results ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {status === 'idle' && (
              <div className="empty-state">
                <div className="empty-icon">🕵️</div>
                <div className="empty-title">Ready to Hunt</div>
                <div className="empty-desc">
                  Enter a role and click Search. We'll scan Tavily + Jina AI across the open web to find recruiters who explicitly share their email addresses in hiring posts.
                </div>
              </div>
            )}

            {status === 'running' && jobs.length === 0 && (
              <div className="empty-state">
                <div className="spinner spinner-lg" style={{ marginBottom: 16 }} />
                <div className="empty-title">Hunting Across the Web...</div>
                <div className="empty-desc">Searching Tavily + Jina AI, extracting with AI, validating emails with Hunter.io</div>
              </div>
            )}

            {jobs.length > 0 && (
              <>
                {/* Stats bar */}
                <div style={{
                  display: 'flex', gap: 12, flexWrap: 'wrap',
                  padding: '12px 16px', background: 'var(--bg-secondary)',
                  borderRadius: 10, border: '1px solid var(--border)',
                }}>
                  {[
                    { label: 'Posts Found', value: jobs.length, color: 'var(--accent-primary)' },
                    { label: 'With Email', value: emailJobs.length, color: 'var(--accent-emerald)' },
                    { label: 'Applied', value: appliedIds.size, color: 'var(--accent-cyan)' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* With email first */}
                {emailJobs.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--accent-emerald)' }}>
                      ✅ Direct Contact Found ({emailJobs.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {emailJobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          applied={appliedIds.has(job.id)}
                          applying={applyingId === job.id}
                          onApply={() => handleApply(job)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* No email */}
                {noEmailJobs.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--accent-amber)' }}>
                      ⚠️ No Email Found — Company Identified ({noEmailJobs.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {noEmailJobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          applied={appliedIds.has(job.id)}
                          applying={applyingId === job.id}
                          onApply={() => handleApply(job)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {status === 'complete' && jobs.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">😕</div>
                <div className="empty-title">No Recruiter Posts Found</div>
                <div className="empty-desc">Try a different role or location. Broader terms tend to find more results.</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function JobCard({ job, applied, applying, onApply }) {
  const level = confidenceLevel(job.confidence || 0);

  return (
    <div className="card" style={{
      padding: 16, position: 'relative', overflow: 'hidden',
      borderColor: applied ? 'rgba(16,185,129,0.3)' : undefined,
      background: applied ? 'rgba(16,185,129,0.04)' : undefined,
    }}>
      {/* Source badge */}
      <span style={{
        position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700,
        padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase',
        background: 'var(--bg-secondary)', color: 'var(--text-muted)',
        border: '1px solid var(--border)',
      }}>
        {job.sourceType || job.source || 'web'}
      </span>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: 'var(--gradient-hero)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800, color: '#fff',
        }}>
          {(job.company || '?')[0].toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
            {job.role || 'Unknown Role'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {job.company} {job.location ? `· ${job.location}` : ''}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
            <ConfidenceBadge value={job.confidence} />
            <EmailBadge email={job.email} status={job.emailStatus} />
            {job.experience && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 7px', borderRadius: 99, border: '1px solid var(--border)' }}>
                {job.experience}
              </span>
            )}
          </div>

          {job.requirements && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
              {job.requirements}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {applied ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-emerald)' }}>✅ Applied</span>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={onApply}
                disabled={applying || !job.email}
                title={!job.email ? 'No email found' : ''}
              >
                {applying ? <><span className="spinner" /> Sending...</> : '🚀 Apply Now'}
              </button>
            )}
            {job.sourceUrl && (
              <a
                href={job.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
              >
                🔗 View Post
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
