'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (res.ok) {
        setStep('verify');
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
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
        router.push('/');
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
          <div className="auth-icon">NEW</div>
          <h1 className="auth-title">
            Join the <span style={{ color: 'var(--accent-primary)' }}>Future</span>
          </h1>
          <p className="auth-subtitle">
            {step === 'register' ? 'Create your FBT account' : 'Verify your email to complete setup'}
          </p>
        </div>

        {step === 'register' ? (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
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
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
            <p className="auth-helper">
              Already have an account? <Link href="/login" className="auth-link">Sign In</Link>
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
            <button className="btn btn-ghost btn-sm auth-back-btn" type="button" onClick={() => setStep('register')}>
              Back to Register
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
