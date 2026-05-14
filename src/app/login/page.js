'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('login'); // login | verify
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/job-tracker');
      } else if (data.needsVerification) {
        setStep('verify');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) {
        router.push('/job-tracker');
      } else {
        const data = await res.json();
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top left, #1e1b4b, #020617)',
      padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 8 }}>
            JobHunt AI <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {step === 'login' ? 'Welcome back, future bounder!' : 'Verify your email to continue'}
          </p>
        </div>

        {step === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <input 
                type="password" 
                className="form-input" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && <div className="alert alert-error" style={{ fontSize: 13 }}>⚠️ {error}</div>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              Don't have an account? <Link href="/register" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Create one</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--text-secondary)' }}>Verification Code</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                maxLength={6}
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 800 }}
                value={code} 
                onChange={e => setCode(e.target.value)}
                placeholder="000000"
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
            </div>
            {error && <div className="alert alert-error" style={{ fontSize: 13 }}>⚠️ {error}</div>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Verify & Enter'}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setStep('login')}>Back to Login</button>
          </form>
        )}
      </div>
    </div>
  );
}
