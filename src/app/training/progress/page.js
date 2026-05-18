'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

export default function LearningProgress() {
  const [paths, setPaths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/training/paths')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Sort by newest first
          setPaths((data.paths || []).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Calculate progress purely based on how many modules have content generated (cached)
  const getProgressStats = (path) => {
    if (!path.chapters) return { total: 0, completed: 0, percentage: 0 };
    
    let totalModules = 0;
    let completedModules = 0;

    path.chapters.forEach(chap => {
      if (chap.modules) {
        totalModules += chap.modules.length;
        chap.modules.forEach(mod => {
          if (path.moduleContent && path.moduleContent[mod.id]) {
            completedModules++;
          }
        });
      }
    });

    const percentage = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
    return { total: totalModules, completed: completedModules, percentage };
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="hero-glow" />

        <div className="page-header">
          <h1 className="page-title">📈 Learning Progress</h1>
          <p className="page-subtitle">Track your training courses and continue where you left off</p>
        </div>

        {loading ? (
          <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
          </div>
        ) : paths.length === 0 ? (
          <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No Learning Paths Found</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>You haven't generated any training courses yet.</p>
            <Link href="/training" className="btn btn-primary">
              Generate Your First Course
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
            {paths.map(path => {
              const stats = getProgressStats(path);
              return (
                <div key={path.id} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ 
                        fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                        background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)',
                        textTransform: 'uppercase'
                      }}>
                        {path.level}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(path.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
                      {path.title || `${path.role} Training`}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {path.description || `Learning path for ${path.role}`}
                    </p>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Course Progress</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{stats.percentage}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.percentage}%`, background: 'var(--gradient-hero)', borderRadius: 4 }} />
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      {stats.completed} of {stats.total} modules unlocked
                    </div>
                  </div>

                  <Link href={`/training?pathId=${path.id}`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                    Continue Learning 🚀
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
