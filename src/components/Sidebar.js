'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV = [
  { label: 'OVERVIEW', items: [
    { href: '/', icon: '⚡', label: 'Dashboard' },
  ]},
  { label: 'TRAINING', items: [
    { href: '/training', icon: '🎓', label: 'Training Portal' },
    { href: '/training/progress', icon: '📈', label: 'Learning Progress' },
    { href: '/training/mock-interview', icon: '🎤', label: 'Mock Interview' },
    { href: '/training/technical-mock', icon: '🧪', label: 'Technical MCQ' },
  ]},
  { label: 'RESUME', items: [
    { href: '/resume-builder', icon: '✨', label: 'Resume Builder' },
    { href: '/resume-vault', icon: '🗄️', label: 'Resume Vault' },
  ]},
  { label: 'JOBS', items: [
    { href: '/job-search', icon: '🔍', label: 'India Jobs' },
    { href: '/autopilot', icon: '🚀', label: 'Auto Apply' },
    { href: '/jobs-applied', icon: '📨', label: 'Jobs Applied' },
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Load collapse state
    const saved = localStorage.getItem('sidebar_collapsed') === 'true';
    setIsCollapsed(saved);
    if (saved) document.body.classList.add('sidebar-collapsed');

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

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', newState);
    if (newState) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  };

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  // Filter navigation dynamically
  const filteredNav = NAV.filter(section => {
    if (section.label === 'ADMIN') {
      return userEmail === 'admin@fbt.com';
    }
    return true;
  });

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" style={{ background: 'transparent' }}>
          <img src="/logo.svg" alt="JobHunt AI Logo" style={{ width: 38, height: 38, borderRadius: 10 }} />
        </div>
        {!isCollapsed && (
          <div>
            <div className="sidebar-logo-text">JobHunt AI</div>
            <div className="sidebar-logo-sub">Welcome, {userName.split(' ')[0]}</div>
          </div>
        )}
        <button onClick={toggleSidebar} className="collapse-toggle" title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}>
          {isCollapsed ? '➡' : '⬅'}
        </button>
      </div>

      <div className="nav-container" style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {filteredNav.map(section => (
          <div key={section.label} className="nav-section">
            {!isCollapsed && <div className="nav-section-label">{section.label}</div>}
            {section.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${pathname === item.href ? ' active' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button 
          onClick={handleLogout}
          className="nav-item logout-btn" 
          title={isCollapsed ? "Logout" : ""}
        >
          <span className="nav-icon">🚪</span> 
          {!isCollapsed && <span className="nav-label">Logout</span>}
        </button>
        <Link
          href="/profile"
          className={`nav-item${pathname === '/profile' ? ' active' : ''}`}
          title={isCollapsed ? "My Profile" : ""}
        >
          <span className="nav-icon">👤</span> 
          {!isCollapsed && <span className="nav-label">My Profile</span>}
        </Link>
      </div>
    </aside>
  );
}
