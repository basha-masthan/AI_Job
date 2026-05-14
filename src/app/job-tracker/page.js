'use client';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';

const COLUMNS = [
  { id: 'wishlist', label: '⭐ Wishlist', color: 'var(--accent-secondary)' },
  { id: 'applied', label: '📨 Applied', color: 'var(--accent-primary)' },
  { id: 'interview', label: '🎯 Interview', color: 'var(--accent-cyan)' },
  { id: 'offer', label: '🎉 Offer', color: 'var(--accent-emerald)' },
  { id: 'rejected', label: '❌ Rejected', color: 'var(--accent-rose)' },
];

const EMPTY_JOB = {
  title: '', company: '', location: '', type: 'Full-time',
  salary: '', url: '', description: '', notes: '', status: 'wishlist',
};

export default function JobTracker() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_JOB);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('kanban'); // 'kanban' | 'list'
  const [filterStatus, setFilterStatus] = useState('all');
  const [preppingId, setPreppingId] = useState(null);
  
  // Nylas state
  const [hasNylas, setHasNylas] = useState(false);
  const [nylasEmail, setNylasEmail] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [toolkit, setToolkit] = useState(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/jobs');
    const data = await r.json();
    setJobs(data.jobs || []);
    setHasNylas(data.hasNylas || false);
    setNylasEmail(data.nylasEmail || '');
    setLoading(false);
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  async function handleSyncEmails() {
    setSyncing(true); setSyncMessage(''); setError('');
    try {
      const res = await fetch('/api/jobs/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync emails');
      
      console.log('🤖 --- AI EMAIL SYNC DEBUG LOG --- 🤖');
      console.log('Total Emails Scanned:', data.debugCount);
      console.table(data.debugInfo);
      console.log('Jobs Created/Updated:', data.jobs);
      
      setSyncMessage(data.message || 'Sync complete.');
      loadJobs();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(''), 5000);
    }
  }

  async function handleSave() {
    if (!form.title || !form.company) { setError('Title and company are required.'); return; }
    setSaving(true); setError('');
    try {
      if (selected) {
        // Update
        const res = await fetch(`/api/jobs/${selected.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Update failed');
      } else {
        // Create
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Create failed');
      }
      setShowForm(false); setSelected(null); setForm(EMPTY_JOB);
      loadJobs();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id, status) {
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    // If moved to applied, notify N8N to start watching emails
    if (status === 'applied') {
      const job = jobs.find(j => j.id === id);
      fetch('/api/n8n/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'application_submitted',
          data: {
            jobId: id,
            title: job?.title,
            company: job?.company,
            url: job?.url
          }
        })
      });
    }

    loadJobs();
  }

  async function handleDelete(id) {
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
    setSelected(null);
    loadJobs();
  }

  async function handleAIApply(job) {
    if (!job.url) { setError('No application URL found for this job.'); return; }
    setPreppingId(job.id);
    setToolkit(null);
    try {
      // 1. Get the best resume (or most recent) for matching
      const rRes = await fetch('/api/resumes');
      const rData = await rRes.json();
      const bestResume = rData.resumes?.[0]; // Simplification: use the first one in vault
      
      if (!bestResume) throw new Error('No resumes found in vault. Upload one first!');

      // 2. Prep the toolkit
      const res = await fetch('/api/ai/prep-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: job.description || job.title, resumeId: bestResume.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setToolkit({ ...data.toolkit, jobUrl: job.url });
      
      // 3. Move to 'applied' in tracker
      if (job.status === 'wishlist') {
        handleStatusChange(job.id, 'applied');
      }

      // 4. Open the link
      window.open(job.url, '_blank');
    } catch (err) {
      setError('AI Apply failed: ' + err.message);
    } finally {
      setPreppingId(null);
    }
  }

  function openEdit(job) {
    setSelected(job);
    setForm({ ...EMPTY_JOB, ...job });
    setShowForm(true);
  }

  const filteredJobs = filterStatus === 'all' ? jobs : jobs.filter(j => j.status.toLowerCase() === filterStatus.toLowerCase());

  const statusColors = {
    wishlist: '#8b5cf6', applied: '#6366f1', interview: '#06b6d4', offer: '#10b981', rejected: '#f43f5e',
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">📋 Job Tracker</h1>
              <p className="page-subtitle">Track every application from wishlist to offer</p>
            </div>
            <div className="flex-row">
              {hasNylas ? (
                <button className="btn btn-secondary" onClick={handleSyncEmails} disabled={syncing}>
                  {syncing ? <><span className="spinner" /> Scanning...</> : '📥 Auto-Sync Emails'}
                </button>
              ) : (
                <a href="/api/nylas/auth" className="btn btn-primary" style={{ background: '#ea4335', borderColor: '#ea4335' }}>
                  ✉️ Connect Gmail
                </a>
              )}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
                {['kanban', 'list'].map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className="btn btn-sm"
                    style={{
                      background: view === v ? 'var(--accent-primary)' : 'transparent',
                      color: view === v ? 'white' : 'var(--text-secondary)',
                      border: 'none',
                    }}
                  >
                    {v === 'kanban' ? '⬛ Kanban' : '☰ List'}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" onClick={() => { setSelected(null); setForm(EMPTY_JOB); setShowForm(true); }}>
                + Add Job
              </button>
            </div>
          </div>
          {syncMessage && <div className="alert alert-success" style={{ marginTop: 16 }}>✅ {syncMessage}</div>}
        </div>

        {/* Stats row */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {COLUMNS.map(col => {
            const count = jobs.filter(j => j.status.toLowerCase() === col.id.toLowerCase()).length;
            return (
              <div key={col.id} className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setFilterStatus(filterStatus === col.id ? 'all' : col.id)}>
                <div className="stat-icon" style={{ background: `${statusColors[col.id]}20` }}>
                  <span style={{ fontSize: 20 }}>{col.label.split(' ')[0]}</span>
                </div>
                <div>
                  <div className="stat-value">{count}</div>
                  <div className="stat-label">{col.label.substring(3)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {filterStatus !== 'all' && (
          <div className="flex-row" style={{ marginBottom: 16 }}>
            <span className="tag tag-primary">Filtered: {filterStatus}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setFilterStatus('all')}>Clear Filter</button>
          </div>
        )}

        {loading ? (
          <div className="empty-state"><div className="spinner spinner-lg" /></div>
        ) : view === 'kanban' ? (
          <div className="kanban-board">
            {COLUMNS.map(col => {
              const colJobs = jobs.filter(j => j.status.toLowerCase() === col.id.toLowerCase());
              return (
                <div key={col.id} className="kanban-col">
                  <div className="kanban-col-header">
                    <div className="kanban-col-title" style={{ color: statusColors[col.id] }}>{col.label}</div>
                    <span className="kanban-count">{colJobs.length}</span>
                  </div>
                  {colJobs.map(job => (
                    <div key={job.id} className="kanban-card" onClick={() => openEdit(job)} style={{ position: 'relative' }}>
                      <button 
                        className="btn-icon" 
                        style={{ 
                          position: 'absolute', top: 8, right: 8, padding: 4, 
                          color: 'var(--text-muted)', fontSize: 14, background: 'transparent',
                          border: 'none', cursor: 'pointer'
                        }}
                        onClick={(e) => { e.stopPropagation(); if(confirm('Delete this job?')) handleDelete(job.id); }}
                      >
                        🗑️
                      </button>
                      <div className="kanban-card-title" style={{ paddingRight: 24 }}>{job.title || job.company}</div>
                      <div className="kanban-card-company">{job.company}</div>
                      <div className="flex-row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {job.location && <span className="tag tag-cyan" style={{ fontSize: 10 }}>{job.location}</span>}
                        {job.type && <span className="tag tag-purple" style={{ fontSize: 10 }}>{job.type}</span>}
                      </div>
                      <div className="kanban-card-meta">
                        {new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {job.url && <span style={{ marginLeft: 8 }}>· <a href={job.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }} onClick={e => e.stopPropagation()}>🔗</a></span>}
                      </div>
                      {/* Quick status change */}
                      <select
                        value={job.status}
                        onChange={e => { e.stopPropagation(); handleStatusChange(job.id, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        className="form-select"
                        style={{ marginTop: 8, fontSize: 11, padding: '4px 8px' }}
                      >
                        {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      {job.url && (
                        <button 
                          className="btn btn-primary btn-xs btn-full" 
                          style={{ marginTop: 8, fontSize: 10 }}
                          onClick={(e) => { e.stopPropagation(); handleAIApply(job); }}
                          disabled={preppingId === job.id}
                        >
                          {preppingId === job.id ? '⏳ Prepping...' : '🚀 AI Apply'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredJobs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div className="empty-title">No jobs found</div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>+ Add Job</button>
              </div>
            ) : filteredJobs.map(job => (
              <div key={job.id} className="card" style={{ padding: 16 }}>
                <div className="flex-between">
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: `${statusColors[job.status]}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>💼</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{job.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{job.company} · {job.location}</div>
                    </div>
                  </div>
                  <div className="flex-row" style={{ gap: 8 }}>
                    <select
                      value={job.status}
                      onChange={e => handleStatusChange(job.id, e.target.value)}
                      className="form-select"
                      style={{ fontSize: 12, padding: '5px 10px', width: 'auto' }}
                    >
                      {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(job)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(job.id)}>🗑️</button>
                    {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">🔗</a>}
                  </div>
                </div>
                {job.notes && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: 54 }}>
                    {job.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">{selected ? '✏️ Edit Job' : '+ Add Job'}</span>
                <button className="modal-close" onClick={() => { setShowForm(false); setSelected(null); setForm(EMPTY_JOB); }}>✕</button>
              </div>
              <div className="flex-col">
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Job Title *</label>
                    <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Senior Developer" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company *</label>
                    <input className="form-input" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Google" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Hyderabad / Remote" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Salary / Package</label>
                    <input className="form-input" value={form.salary} onChange={e => setForm(f => ({ ...f, salary: e.target.value }))} placeholder="₹12-18 LPA" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Job URL</label>
                  <input className="form-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" style={{ minHeight: 80 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Interview date, recruiter name, follow-up reminder..." />
                </div>
                {error && <div className="alert alert-error">⚠️ {error}</div>}
                <div className="flex-row">
                  <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <><span className="spinner" /> Saving...</> : selected ? 'Save Changes' : 'Add Job'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setShowForm(false); setSelected(null); setForm(EMPTY_JOB); }}>Cancel</button>
                  {selected && <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={() => handleDelete(selected.id)}>Delete</button>}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Toolkit Modal/Panel */}
        {toolkit && (
          <div className="card" style={{ 
            position: 'fixed', bottom: 24, right: 24, width: 420, zIndex: 1000, 
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)', border: '2px solid var(--accent-primary)',
            background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', maxHeight: '80vh'
          }}>
            <div className="flex-between" style={{ padding: '12px 16px', background: 'var(--accent-primary)', color: 'white' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>🚀 AI Application Assistant</span>
              <button onClick={() => setToolkit(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              <div className="alert alert-success" style={{ fontSize: 11, marginBottom: 16 }}>
                ✅ Application link opened! Use the data below to fill the form.
              </div>

              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📄 Cover Letter</h4>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: 10, borderRadius: 6, whiteSpace: 'pre-wrap', marginBottom: 12, border: '1px solid var(--border)' }}>
                {toolkit.coverLetter}
              </div>
              <button className="btn btn-secondary btn-sm btn-full" onClick={() => { navigator.clipboard.writeText(toolkit.coverLetter); alert('Cover letter copied!'); }}>📋 Copy Letter</button>

              <hr style={{ margin: '16px 0', borderColor: 'var(--border)' }} />

              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>💬 Screener Answers</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {toolkit.questions.map((q, i) => (
                  <div key={i} style={{ background: 'var(--bg-secondary)', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 4 }}>{q.q}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.a}</div>
                    <button className="btn btn-ghost btn-xs" style={{ marginTop: 4 }} onClick={() => { navigator.clipboard.writeText(q.a); }}>Copy Answer</button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              <a href={toolkit.jobUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm btn-full">Return to Application Tab</a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
