'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV = [
  { label: 'OVERVIEW', items: [
    { href: '/', icon: '⚡', label: 'Dashboard' },
    { href: '/profile', icon: '👤', label: 'My Profile' },
  ]},
  { label: 'RESUME', items: [
    { href: '/resume-builder', icon: '✨', label: 'Resume Builder' },
    { href: '/resume-vault', icon: '🗄️', label: 'Resume Vault' },
  ]},
  { label: 'JOBS', items: [
    { href: '/job-tracker', icon: '📋', label: 'Job Tracker' },
    { href: '/job-fetcher', icon: '🔗', label: 'Job Fetcher' },
  ]},
  { label: 'ADMIN', items: [
    { href: '/admin', icon: '👑', label: 'Control Center' },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.profile) {
          setUserName(data.profile.name || 'FBT Professional');
          setUserEmail(data.profile.email);
        }
      })
      .catch(console.error);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  // Filter navigation dynamically
  const filteredNav = NAV.filter(section => {
    if (section.label === 'ADMIN') {
      return userEmail === 'admin@fbt.com';
    }
    return true;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🚀</div>
        <div>
          <div className="sidebar-logo-text">JobHunt AI</div>
          <div className="sidebar-logo-sub">Welcome, {userName}</div>
        </div>
      </div>

      {filteredNav.map(section => (
        <div key={section.label}>
          <div className="nav-section-label">{section.label}</div>
          {section.items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${pathname === item.href ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      ))}

      <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
        <button 
          onClick={handleLogout}
          className="nav-item" 
          style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', marginBottom: 16, color: 'inherit', textAlign: 'left', padding: '8px 12px' }}
        >
          <span className="nav-icon">🚪</span> Logout
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>⚡ AI Model</div>
          Groq · llama-3.3-70b<br />
          <span style={{ color: 'var(--accent-emerald)' }}>● Active</span>
        </div>
      </div>
    </aside>
  );
}
