'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'smtp', label: 'Email Setup' },
  { id: 'instructions', label: 'App Password' },
  { id: 'done', label: 'Done' },
];

export default function SmtpSetupPage() {
  const [step, setStep] = useState('welcome');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [skipLoading, setSkipLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/smtp')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.onboardingComplete) {
          router.push('/');
        }
      });
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    if (!smtpUser || !smtpPass) { setError('Both fields are required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpUser, smtpPass }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('done');
      } else {
        setError(data.error || 'Failed to save settings');
      }
    } catch { setError('Connection error'); }
    finally { setLoading(false); }
  }

  async function handleSkip() {
    setSkipLoading(true);
    await fetch('/api/auth/smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtpUser: '', smtpPass: '' }),
    });
    router.push('/');
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 20,
    }}>
      <div className="card" style={{ maxWidth: 560, width: '100%', padding: 32 }}>

        {/* Progress Bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 32 }}>
          {STEPS.map((s, i) => {
            const idx = STEPS.findIndex(x => x.id === step);
            const active = i <= idx;
            return (
              <div key={s.id} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: active ? 'var(--accent-primary)' : 'var(--border)',
                transition: 'background 0.3s',
              }} />
            );
          })}
        </div>

        {step === 'welcome' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>👋</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Welcome to JobHunt AI</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
              Let's set up your email so you can send applications automatically.
              You'll need a Gmail account with an App Password.
            </p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
              onClick={() => setStep('instructions')}>Get Started</button>
          </>
        )}

        {step === 'instructions' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>🔐</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Generate Gmail App Password</h2>
            <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>
                Go to{' '}
                <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  Google Account Security
                </a>
              </li>
              <li>Turn on <strong>2-Step Verification</strong> if not already enabled</li>
              <li>Search for <strong>"App Passwords"</strong> in the Google search bar at the top</li>
              <li>Select <strong>Mail</strong> as the app and <strong>Other</strong> as the device (name it "JobHunt AI")</li>
              <li>Copy the <strong>16-character password</strong> that appears (it looks like: <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>abcd efgh ijkl mnop</code>)</li>
              <li>Paste it below — this is the only time you'll see it</li>
            </ol>
            <div style={{ marginTop: 12, padding: 12, background: '#f59e0b15', borderRadius: 8, border: '1px solid #f59e0b30', fontSize: 12, color: 'var(--text-primary)' }}>
              ⚠️ The App Password is <strong>different</strong> from your regular Gmail password.
              Your normal password won't work here.
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 20 }}
              onClick={() => setStep('smtp')}>I have my App Password →</button>
          </>
        )}

        {step === 'smtp' && (
          <form onSubmit={handleSave}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Configure Email</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Enter your Gmail address and the App Password you just created.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Gmail Address</label>
                <input type="email" value={smtpUser} onChange={e => setSmtpUser(e.target.value)}
                  placeholder="you@gmail.com" className="form-input" required />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>App Password (16 characters)</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={smtpPass}
                    onChange={e => setSmtpPass(e.target.value)}
                    placeholder="abcd efgh ijkl mnop" className="form-input"
                    style={{ paddingRight: 40 }} required />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 8, top: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>
                  🔒 This is encrypted and stored securely. Only used to send your job applications.
                </p>
              </div>

              {error && <div className="alert alert-error" style={{ fontSize: 13 }}>{error}</div>}

              <button className="btn btn-primary btn-lg" type="submit" disabled={loading}
                style={{ width: '100%' }}>
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>

              <button type="button" className="btn btn-ghost btn-sm" onClick={handleSkip}
                disabled={skipLoading} style={{ width: '100%', textAlign: 'center' }}>
                {skipLoading ? 'Please wait...' : 'Skip for now — I\'ll configure later'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>🎉</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>You're all set!</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
              Your email is configured. You can now use the <strong>Auto Apply</strong> feature to send applications directly from your Gmail.
            </p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
              onClick={() => router.push('/')}>
              🚀 Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
