'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';

export default function ResumeVault() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef(null);

  // Match state
  const [matchMode, setMatchMode] = useState(false);
  const [jd, setJd] = useState('');
  const [matching, setMatching] = useState(false);
  const [matchResults, setMatchResults] = useState(null);

  const loadResumes = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/resumes');
    const data = await r.json();
    setResumes(data.resumes || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadResumes(); }, [loadResumes]);

  // ── Upload handlers ──────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadFile(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) setUploadFile(file);
  }

  async function handleUpload() {
    if (!uploadFile) { setError('Please select a file.'); return; }
    setError(''); setUploading(true); setUploadSuccess('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('notes', uploadNotes);

      const res = await fetch('/api/resumes/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setUploadSuccess(`✅ "${uploadFile.name}" uploaded successfully!`);
      setUploadFile(null);
      setUploadNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadResumes();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // ── Match handler ───────────────────────────────────────
  async function handleMatch() {
    if (!jd.trim()) { setError('Please paste a JD.'); return; }
    setError(''); setMatching(true); setMatchResults(null);
    try {
      const res = await fetch('/api/ai/match-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMatchResults(data.matches);
    } catch (err) {
      setError(err.message);
    } finally {
      setMatching(false);
    }
  }

  async function handleToggleFavorite(id) {
    try {
      const res = await fetch(`/api/resumes/toggle-favorite/${id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResumes(prev => prev.map(r => r.id === id ? { ...r, isFavorite: data.isFavorite } : r));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    await fetch(`/api/resumes/${id}`, { method: 'DELETE' });
    setDeleteId(null);
    setSelected(null);
    loadResumes();
  }

  async function handleEditName(id) {
    if (!editName.trim()) {
      setError('Name cannot be empty');
      return;
    }
    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setEditId(null);
      setEditName('');
      loadResumes();
    } catch (err) {
      setError(err.message);
    }
  }

  function getScoreColor(score) {
    if (score >= 80) return 'var(--accent-emerald)';
    if (score >= 60) return 'var(--accent-amber)';
    return 'var(--accent-rose)';
  }

  function getFileIcon(r) {
    if (r.source === 'manual-upload') {
      if (r.fileType?.includes('pdf')) return '📕';
      if (r.fileType?.includes('word')) return '📘';
      return '📄';
    }
    return '🤖';
  }

  const aiResumes = resumes.filter(r => r.source === 'ai-generated');
  const manualResumes = resumes.filter(r => r.source === 'manual-upload');

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        {/* Header */}
        <div className="page-header">
          <div className="flex-between">
            <div>
              <h1 className="page-title">🗄️ Resume Vault</h1>
              <p className="page-subtitle">
                {resumes.length} resume{resumes.length !== 1 ? 's' : ''} stored on Cloudinary
                · {aiResumes.length} AI-generated · {manualResumes.length} manual uploads
              </p>
            </div>
            <div className="flex-row">
              <button
                className={`btn ${matchMode ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setMatchMode(!matchMode); setMatchResults(null); setError(''); }}
              >
                🔍 {matchMode ? 'Close Matcher' : 'Match to JD'}
              </button>
              <button
                className={`btn ${showUpload ? 'btn-secondary' : 'btn-secondary'}`}
                onClick={() => { setShowUpload(!showUpload); setError(''); setUploadSuccess(''); }}
              >
                📤 {showUpload ? 'Close Upload' : 'Upload Resume'}
              </button>
              <Link href="/resume-builder" className="btn btn-primary">✨ AI Generate</Link>
            </div>
          </div>
        </div>

        {/* ── Manual Upload Panel ── */}
        {showUpload && (
          <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(6,182,212,0.3)' }}>
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>📤 Upload Your Resume</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stored securely on Cloudinary · PDF, DOC, DOCX, TXT · Max 5MB</span>
            </div>

            {/* Drag-and-drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent-cyan)' : uploadFile ? 'var(--accent-emerald)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'var(--transition)',
                background: dragOver ? 'rgba(6,182,212,0.05)' : uploadFile ? 'rgba(16,185,129,0.05)' : 'var(--bg-secondary)',
                marginBottom: 16,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              {uploadFile ? (
                <>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>
                    {uploadFile.name.endsWith('.pdf') ? '📕' : uploadFile.name.endsWith('.txt') ? '📄' : '📘'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent-emerald)', marginBottom: 4 }}>
                    {uploadFile.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {(uploadFile.size / 1024).toFixed(1)} KB · Click to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>☁️</div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
                    {dragOver ? 'Drop it here!' : 'Drag & drop or click to browse'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF · DOC · DOCX · TXT · Max 5MB</div>
                </>
              )}
            </div>

            <div className="grid-2" style={{ gap: 12, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Label / Notes (optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g. Backend Dev Resume 2025, Fresher Resume..."
                  value={uploadNotes}
                  onChange={e => setUploadNotes(e.target.value)}
                />
              </div>
              <div style={{ paddingTop: 22 }}>
                <button
                  className="btn btn-primary btn-full"
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? (
                    <><span className="spinner" /> Uploading to Cloudinary...</>
                  ) : '☁️ Upload to Vault'}
                </button>
              </div>
            </div>

            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}
            {error && <div className="alert alert-error">⚠️ {error}</div>}
          </div>
        )}

        {/* ── AI Match Panel ── */}
        {matchMode && (
          <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(99,102,241,0.3)' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>🤖 AI Resume Matcher</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Paste a JD — AI ranks your saved resumes by match score with strengths and gap analysis.
            </p>
            <textarea
              className="form-textarea"
              style={{ minHeight: 140, marginBottom: 12 }}
              placeholder="Paste job description here..."
              value={jd}
              onChange={e => setJd(e.target.value)}
            />
            {!uploadSuccess && error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
            <button className="btn btn-primary" onClick={handleMatch} disabled={matching || !jd.trim()}>
              {matching ? <><span className="spinner" /> Analyzing {resumes.length} resume{resumes.length !== 1 ? 's' : ''}...</> : '🔍 Find Best Match'}
            </button>

            {matchResults && (
              <div style={{ marginTop: 20 }}>
                <hr className="divider" />
                <h4 style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>📊 Match Results</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {matchResults.map((m, i) => (
                    <div key={m.id} className="card" style={{ padding: 16 }}>
                      <div className="flex-between" style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: i === 0 ? 'var(--gradient-hero)' : 'var(--bg-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700,
                            color: i === 0 ? 'white' : 'var(--text-muted)', flexShrink: 0,
                          }}>#{i + 1}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{m.resumeMeta?.name || m.resumeMeta?.jobTitle || 'Resume'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.resumeMeta?.jobTitle}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: getScoreColor(m.score), fontFamily: 'Space Grotesk' }}>{m.score}%</div>
                        </div>
                      </div>
                      <div className="progress-bar" style={{ marginBottom: 10 }}>
                        <div className="progress-fill" style={{ width: `${m.score}%`, background: getScoreColor(m.score) }} />
                      </div>
                      <div className="grid-2" style={{ gap: 10, fontSize: 12 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 4 }}>✅ Strengths</div>
                          {m.strengths?.map((s, j) => <div key={j} style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>· {s}</div>)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--accent-amber)', marginBottom: 4 }}>⚠️ Gaps</div>
                          {m.gaps?.map((g, j) => <div key={j} style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>· {g}</div>)}
                        </div>
                      </div>
                      {m.recommendation && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          💡 {m.recommendation}
                        </div>
                      )}
                      <div style={{ marginTop: 10 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelected(resumes.find(r => r.id === m.id))}>
                          View Resume
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Resume Grid ── */}
        {loading ? (
          <div className="empty-state"><div className="spinner spinner-lg" /></div>
        ) : resumes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <div className="empty-title">Your vault is empty</div>
            <div className="empty-desc">Upload an existing resume or generate a new one with AI</div>
            <div className="flex-row" style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowUpload(true)}>📤 Upload Resume</button>
              <Link href="/resume-builder" className="btn btn-primary">✨ AI Generate</Link>
            </div>
          </div>
        ) : (
          <>
            {/* Manual uploads section */}
            {manualResumes.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📤 Uploaded Resumes
                  <span className="kanban-count">{manualResumes.length}</span>
                </h2>
                <div className="grid-3">
                  {manualResumes.map(r => (
                    <ResumeCard
                      key={r.id}
                      resume={r}
                      icon={getFileIcon(r)}
                      onView={() => setSelected(r)}
                      onDelete={() => setDeleteId(r.id)}
                      onEdit={() => { setEditId(r.id); setEditName(r.fileName || ''); }}
                      onToggleFavorite={() => handleToggleFavorite(r.id)}
                      tagColor="tag-cyan"
                      tagLabel="Uploaded"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* AI generated section */}
            {aiResumes.length > 0 && (
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🤖 AI-Generated Resumes
                  <span className="kanban-count">{aiResumes.length}</span>
                </h2>
                <div className="grid-3">
                  {aiResumes.map(r => (
                    <ResumeCard
                      key={r.id}
                      resume={r}
                      icon="🤖"
                      onView={() => setSelected(r)}
                      onDelete={() => setDeleteId(r.id)}
                      onEdit={() => { setEditId(r.id); setEditName(r.fileName || ''); }}
                      onToggleFavorite={() => handleToggleFavorite(r.id)}
                      tagColor="tag-primary"
                      tagLabel="AI-Generated"
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Resume Viewer Modal ── */}
        {selected && (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">{getFileIcon(selected)} {selected.fileName || selected.data?.name || 'Resume'}</span>
                <div className="flex-row">
                  {selected.cloudinaryUrl && (
                    <a
                      href={selected.cloudinaryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      ☁️ Open on Cloudinary
                    </a>
                  )}
                  <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                </div>
              </div>

              {selected.source === 'manual-upload' ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>{getFileIcon(selected)}</div>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{selected.fileName || selected.data?.name || 'Resume'}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {selected.jobTitle && <span>Label: {selected.jobTitle}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
                    Uploaded {new Date(selected.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {selected.cloudinaryUrl ? (
                    <a href={`/api/resumes/${selected.id}/download`} className="btn btn-primary">
                      📥 Download / View File
                    </a>
                  ) : (
                    <div className="alert alert-info">File URL not available</div>
                  )}
                </div>
              ) : selected.cloudinaryUrl ? (
                <div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <a
                      href={`/api/resumes/${selected.id}/download`}
                      className="btn btn-primary btn-sm"
                    >
                      📥 Download PDF
                    </a>
                    <a
                      href={`/api/resumes/${selected.id}/download?inline=1`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      👁️ Open in New Tab
                    </a>
                    {selected.pdfSize && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>
                        {(selected.pdfSize / 1024).toFixed(1)} KB PDF
                      </span>
                    )}
                  </div>
                  <iframe
                    src={`/api/resumes/${selected.id}/download?inline=1`}
                    title={selected.fileName || selected.data?.name || 'Resume'}
                    style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: 8 }}
                  />
                </div>
              ) : (
                <div>
                  <div className="alert alert-info" style={{ marginBottom: 12 }}>
                    ⚠️ This AI resume doesn't have a PDF yet. Click below to generate one.
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ marginBottom: 16 }}
                    onClick={async () => {
                      try {
                        setError('');
                        const res = await fetch(`/api/resumes/${selected.id}/generate-pdf`, { method: 'POST' });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'PDF generation failed');
                        loadResumes();
                        setSelected({ ...selected, cloudinaryUrl: data.cloudinaryUrl, fileType: 'application/pdf' });
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  >
                    📄 Generate PDF Now
                  </button>
                  <div className="resume-viewer" dangerouslySetInnerHTML={{ __html: buildResumeHTML(selected.data) }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Delete Confirm ── */}
        {deleteId && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <span className="modal-title">🗑️ Delete Resume?</span>
                <button className="modal-close" onClick={() => setDeleteId(null)}>✕</button>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
                This will permanently delete the resume from Cloudinary and your vault.
              </p>
              <div className="flex-row">
                <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Yes, Delete</button>
                <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Name Modal ── */}
        {editId && (
          <div className="modal-overlay" onClick={() => setEditId(null)}>
            <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">✏️ Edit Resume Name</span>
                <button className="modal-close" onClick={() => setEditId(null)}>✕</button>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Resume Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="e.g., Senior Developer Resume"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleEditName(editId); }}
                />
              </div>
              {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {error}</div>}
              <div className="flex-row">
                <button className="btn btn-primary" onClick={() => handleEditName(editId)}>Save</button>
                <button className="btn btn-ghost" onClick={() => { setEditId(null); setEditName(''); setError(''); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ResumeCard({ resume, icon, onView, onDelete, onEdit, onToggleFavorite, tagColor, tagLabel }) {
  return (
    <div className={`resume-card ${resume.isFavorite ? 'favorite' : ''}`} style={{ position: 'relative' }}>
      <button 
        className={`star-btn ${resume.isFavorite ? 'active' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        title={resume.isFavorite ? 'Remove from favorites' : 'Mark as master profile'}
      >
        {resume.isFavorite ? '⭐' : '☆'}
      </button>

      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: tagLabel === 'Uploaded' ? 'rgba(6,182,212,0.15)' : 'var(--gradient-hero)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>{icon}</div>
        <div className="flex-row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={onView}>View</button>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit name">✏️</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}>🗑️</button>
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
        {resume.fileName || resume.data?.name || 'Resume'}
      </div>
      <div style={{ fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className={`tag ${tagColor}`} style={{ fontSize: 10 }}>{tagLabel}</span>
        {resume.jobTitle && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{resume.jobTitle}</span>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        {new Date(resume.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>

      {resume.data?.skills?.technical?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {resume.data.skills.technical.slice(0, 4).map(s => (
            <span key={s} className="tag tag-primary" style={{ fontSize: 10 }}>{s}</span>
          ))}
          {resume.data.skills.technical.length > 4 && (
            <span className="tag tag-primary" style={{ fontSize: 10 }}>+{resume.data.skills.technical.length - 4}</span>
          )}
        </div>
      )}

      {resume.cloudinaryUrl && (
        <div style={{ marginTop: 10 }}>
          <a href={resume.cloudinaryUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
            ☁️ Cloudinary
          </a>
        </div>
      )}
    </div>
  );
}

function buildResumeHTML(d) {
  if (!d) return '<p style="color:#666;text-align:center;padding:20px;">No preview available for this resume type.</p>';
  const c = d.contact || {};
  const contact = [c.email, c.phone, c.location, c.linkedin, c.github].filter(Boolean).join(' · ');

  const skills = d.skills ? Object.entries(d.skills).map(([k, v]) =>
    `<div class="rv-skill-group"><span class="rv-skill-label">${k.charAt(0).toUpperCase() + k.slice(1)}:</span> ${Array.isArray(v) ? v.join(', ') : v}</div>`
  ).join('') : '';

  const exp = (d.experience || []).map(e => `
    <div class="rv-exp-item">
      <div class="rv-exp-role">${e.role || ''}</div>
      <div class="rv-exp-company">${e.company || ''} · ${e.location || ''} · <span class="rv-exp-duration">${e.duration || ''}</span></div>
      ${e.bullets ? `<ul>${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
    </div>`).join('');

  const edu = (d.education || []).map(e => `
    <div class="rv-exp-item">
      <div class="rv-exp-role">${e.degree || ''}</div>
      <div class="rv-exp-company">${e.institution || ''} · ${e.year || ''} ${e.cgpa ? '· CGPA: ' + e.cgpa : ''}</div>
    </div>`).join('');

  const proj = (d.projects || []).map(p => `
    <div class="rv-exp-item">
      <div class="rv-exp-role">${p.name || ''}</div>
      <div style="font-size:12px;color:#333">${p.description || ''}</div>
      ${p.tech ? `<div style="font-size:11px;color:#6366f1;margin-top:2px">${p.tech.join(' · ')}</div>` : ''}
    </div>`).join('');

  return `
    <h1>${d.name || 'Resume'}</h1>
    <div class="rv-contact">${contact}</div>
    ${d.summary ? `<div class="rv-section"><div class="rv-section-title">Professional Summary</div><div class="rv-summary">${d.summary}</div></div>` : ''}
    ${skills ? `<div class="rv-section"><div class="rv-section-title">Skills</div>${skills}</div>` : ''}
    ${exp ? `<div class="rv-section"><div class="rv-section-title">Experience</div>${exp}</div>` : ''}
    ${edu ? `<div class="rv-section"><div class="rv-section-title">Education</div>${edu}</div>` : ''}
    ${proj ? `<div class="rv-section"><div class="rv-section-title">Projects</div>${proj}</div>` : ''}
  `;
}
