'use client';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV = [
  { label: 'OVERVIEW', items: [
    { href: '/', icon: '⚡', label: 'Dashboard' },
  ]},
  { label: 'AUTO APPLY', items: [
    { href: '/auto-apply', icon: '🚀', label: 'Auto Apply' },
    { href: '/jobs-applied', icon: '📨', label: 'Applied Jobs' },
    { href: '/job-tracker', icon: '📋', label: 'Job Tracker' },
  ]},
  { label: 'FIND OPEN ROLE', items: [
    { href: '/job-search', icon: '🔍', label: 'Find Open role' },
    { href: '/job-fetcher', icon: '🔗', label: 'Job JD extract' },
    { href: '/recruiter-finder', icon: '🕵️', label: 'Recruiter Finder' },
  ]},
  { label: 'RESUME', items: [
    { href: '/resume-builder', icon: '✨', label: 'Resume Builder' },
    { href: '/resume-vault', icon: '🗄️', label: 'Resume Vault' },
  ]},
  { label: 'TRAINING', items: [
    { href: '/training', icon: '🎓', label: 'Training Portal' },
    { href: '/training/progress', icon: '📈', label: 'Learning Progress' },
    { href: '/training/mock-interview', icon: '🎤', label: 'Mock Interview' },
    { href: '/training/technical-mock', icon: '🧪', label: 'Technical MCQ' },
  ]},
  { label: 'ADMIN', items: [
    { href: '/admin', icon: '👑', label: 'Control Center' },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  
  // Gmail-style Sidebar States
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  
  // Accordion State
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    // Load pinned state
    const savedPin = localStorage.getItem('sidebar_pinned');
    if (savedPin !== null) {
      const pinned = savedPin === 'true';
      setIsPinned(pinned);
      if (!pinned) document.body.classList.add('sidebar-unpinned');
    }

    // Auto-open section that contains the active route
    const initialOpen = {};
    NAV.forEach(sec => {
      if (sec.items.some(item => item.href === pathname)) {
        initialOpen[sec.label] = true;
      }
    });
    setOpenSections(initialOpen);

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.profile) {
          setUserName(data.profile.name || 'FBT Professional');
          setUserEmail(data.profile.email);
        }
      })
      .catch(console.error);
  }, [pathname]);

  const togglePin = () => {
    const newState = !isPinned;
    setIsPinned(newState);
    localStorage.setItem('sidebar_pinned', newState);
    if (!newState) {
      document.body.classList.add('sidebar-unpinned');
    } else {
      document.body.classList.remove('sidebar-unpinned');
    }
  };

  const toggleSection = (label) => {
    setOpenSections(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  const filteredNav = NAV.filter(section => {
    if (section.label === 'ADMIN') return userEmail === 'admin@fbt.com';
    return true;
  });

  const isExpanded = isPinned || isHovered;
  const sidebarClass = `sidebar ${!isExpanded ? 'collapsed' : ''} ${!isPinned && isHovered ? 'unpinned-expanded' : ''}`;

  return (
    <aside 
      className={sidebarClass}
      onMouseEnter={() => !isPinned && setIsHovered(true)}
      onMouseLeave={() => !isPinned && setIsHovered(false)}
    >
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={togglePin} className="hamburger-btn" title={isPinned ? "Unpin Menu" : "Pin Menu"}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          
          {isExpanded && (
            <div className="sidebar-logo-text-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/logo.svg" alt="Logo" style={{ width: 28, height: 28, borderRadius: 6 }} />
              <div>
                <div className="sidebar-logo-text" style={{ fontSize: 15 }}>JobHunt AI</div>
                <div className="sidebar-logo-sub" style={{ fontSize: 10 }}>Welcome, {userName.split(' ')[0]}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="nav-container">
        {filteredNav.map(section => {
          const isOpen = openSections[section.label];
          // For single-item sections like Overview, just render it without accordion
          if (section.items.length === 1 && section.label === 'OVERVIEW') {
            const item = section.items[0];
            return (
              <div key={section.label} className="nav-section">
                <Link
                  href={item.href}
                  className={`nav-item${pathname === item.href ? ' active' : ''}`}
                  title={!isExpanded ? item.label : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {isExpanded && <span className="nav-label">{item.label}</span>}
                </Link>
              </div>
            );
          }

          return (
            <div key={section.label} className="nav-section accordion-section">
              <button 
                className={`accordion-header ${isOpen ? 'open' : ''} ${!isExpanded ? 'collapsed-view' : ''}`} 
                onClick={() => isExpanded ? toggleSection(section.label) : null}
                title={!isExpanded ? section.label : ''}
              >
                {isExpanded ? (
                  <>
                    <span className="accordion-title">{section.label}</span>
                    <span className="accordion-chevron">▼</span>
                  </>
                ) : (
                  <span className="nav-icon" style={{ fontSize: 16 }}>{section.items[0].icon}</span>
                )}
              </button>
              
              {(isOpen || !isExpanded) && (
                <div className={`accordion-content ${!isExpanded ? 'hide-in-collapsed' : ''}`}>
                  {section.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item accordion-item ${pathname === item.href ? ' active' : ''}`}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <Link
          href="/profile"
          className={`nav-item${pathname === '/profile' ? ' active' : ''}`}
          title={!isExpanded ? "My Profile" : ""}
        >
          <span className="nav-icon">👤</span> 
          {isExpanded && <span className="nav-label">My Profile</span>}
        </Link>
        <button 
          onClick={handleLogout}
          className="nav-item logout-btn" 
          title={!isExpanded ? "Logout" : ""}
        >
          <span className="nav-icon">🚪</span> 
          {isExpanded && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
