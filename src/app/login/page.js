'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirectTo, setRedirectTo] = useState('/');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectParam = searchParams.get('redirect');
    if (redirectParam) setRedirectTo(redirectParam);
  }, [searchParams]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        try {
          const smtpRes = await fetch('/api/auth/smtp');
          const smtpData = await smtpRes.json();
          if (smtpData.success && !smtpData.smtpConfigured && !smtpData.onboardingComplete) {
            router.push('/smtp-setup');
          } else {
            router.push(redirectTo);
          }
        } catch {
          router.push(redirectTo);
        }
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
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (res.ok) {
        router.push(redirectTo);
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
    <div className="auth-shell">
      <div className="card auth-card">
        <div className="auth-header">
          <div className="auth-icon">AI</div>
          <h1 className="auth-title">
            JobHunt AI <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
          </h1>
          <p className="auth-subtitle">
            {step === 'login' ? 'Welcome back, future bounder!' : 'Verify your email to continue'}
          </p>
        </div>

        {step === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
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
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="********"
              />
            </div>
            {error && <div className="alert alert-error auth-error">! {error}</div>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign In'}
            </button>
            <p className="auth-helper">
              Don't have an account? <Link href="/register" className="auth-link">Create one</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="auth-form">
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input
                type="text"
                className="form-input auth-code-input"
                required
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="000000"
              />
              <p className="auth-code-note">
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
            </div>
            {error && <div className="alert alert-error auth-error">! {error}</div>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Verify & Enter'}
            </button>
            <button className="btn btn-ghost btn-sm auth-back-btn" type="button" onClick={() => setStep('login')}>
              Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-shell loading">
        <div className="spinner spinner-lg" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
