'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const JOB_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Remote'];
const EXPERIENCE_LEVELS = [
  { label: 'Any Experience', value: '' },
  { label: 'Fresher (0-1 yrs)', value: '0-1' },
  { label: 'Junior (1-3 yrs)', value: '1-3' },
  { label: 'Mid (3-5 yrs)', value: '3-5' },
  { label: 'Senior (5-8 yrs)', value: '5-8' },
  { label: 'Lead (8+ yrs)', value: '8-15' },
];
const SALARY_RANGES = [
  { label: 'Any Salary', value: '' },
  { label: '₹3L+', value: '300000' },
  { label: '₹5L+', value: '500000' },
  { label: '₹10L+', value: '1000000' },
  { label: '₹20L+', value: '2000000' },
  { label: '₹50L+', value: '5000000' },
];

const SOURCE_COLORS = {
  linkedin: '#0077b5',
  indeed: '#2164f3',
  naukri: '#ff7555',
  jsearch: '#6366f1',
  adzuna: '#00b4d8',
  remotive: '#06d6a0',
  arbeitnow: '#f77f00',
  cutshort: '#6c47ff',
  internshala: '#00c9a7',
};

function getSourceColor(source = '') {
  const key = source.toLowerCase().split(' ')[0];
  return SOURCE_COLORS[key] || 'var(--accent-primary)';
}

const STORAGE_KEY = 'jh_india_jobs_v2';

export default function IndiaJobsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('India');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    remote: false,
    jobType: [],
    experience: '',
    salaryMin: '',
  });
  const [hasRestored, setHasRestored] = useState(false);
  const [sortBy, setSortBy] = useState('relevance');
  const [lastSearch, setLastSearch] = useState({ query: '', location: '' });
  const initialLoadDone = useRef(false);

  // Start fresh on mount - do not load stale/saved search cache
  useEffect(() => {
    setHasRestored(true);
  }, []);

  const persistResults = (jobs, q, loc, fil, hasMore, total) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        jobs, query: q, location: loc, filters: fil, hasMore, total, timestamp: Date.now()
      }));
    } catch (e) {}
  };

  const handleSearch = useCallback(async (e, resetPage = true) => {
    if (e) e.preventDefault();
    const currentPage = resetPage ? 1 : page;
    if (resetPage) {
      setLoading(true);
      setJobs([]);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        query,
        location,
        remote: filters.remote,
        experience: filters.experience,
        salary_min: filters.salaryMin,
        job_type: filters.jobType.join(','),
        page: currentPage,
      });
      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      const fetched = data.jobs || [];

      if (resetPage) {
        setJobs(fetched);
        setLastSearch({ query, location });
        persistResults(fetched, query, location, filters, data.hasMore, data.total);
      } else {
        setJobs(prev => {
          const combined = [...prev, ...fetched];
          persistResults(combined, query, location, filters, data.hasMore, data.total);
          return combined;
        });
        setPage(prev => prev + 1);
      }

      setHasMore(data.hasMore || false);
      setTotal(data.total || fetched.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, location, filters, page]);

  const toggleJobType = (type) => {
    setFilters(prev => ({
      ...prev,
      jobType: prev.jobType.includes(type)
        ? prev.jobType.filter(t => t !== type)
        : [...prev.jobType, type]
    }));
  };

  const handleViewDetails = (job) => {
    if (!job.url || job.url === '#') return;
    // Store preview for job fetcher, then open URL
    localStorage.setItem('jh_prefill_job_preview', JSON.stringify({
      title: job.title, company: job.company, location: job.location, salary: job.salary,
    }));
  };



  const sortedJobs = [...jobs];
  if (sortBy === 'salary-high') {
    sortedJobs.sort((a, b) => {
      const parse = s => parseInt((s || '').replace(/[^0-9]/g, '')) || 0;
      return parse(b.salary) - parse(a.salary);
    });
  } else if (sortBy === 'newest') {
    sortedJobs.sort((a, b) => {
      const order = { 'Today': 0, 'Yesterday': 1 };
      return (order[a.posted] ?? 99) - (order[b.posted] ?? 99);
    });
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">🇮🇳 India Jobs</h1>
            <p className="page-subtitle">
              Real individual job listings from top portals — apply directly, no login required
            </p>
          </div>

          {/* Search Bar */}
          <div className="card-glass" style={{ padding: '24px', border: '1px solid var(--accent-primary)', borderRadius: 24 }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 18, marginRight: 8 }}>🔍</span>
                  <input
                    className="form-input"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Job Title, Skills, or Company..."
                    style={{ border: 'none', background: 'transparent', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', height: 48 }}
                  />
                </div>
                <div style={{ width: 200, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 16, marginRight: 8 }}>📍</span>
                  <input
                    className="form-input"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="City or India"
                    style={{ border: 'none', background: 'transparent', fontSize: 14, height: 48 }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ height: 48, padding: '0 32px', borderRadius: 12, fontSize: 15, fontWeight: 700 }}>
                  {loading ? <span className="spinner" /> : 'Find Jobs'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <label style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={filters.remote} onChange={e => setFilters({ ...filters, remote: e.target.checked })} />
                  Remote Only
                </label>
                <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, alignSelf: 'center' }}>TYPE:</span>
                  {JOB_TYPES.map(type => (
                    <button key={type} type="button" onClick={() => toggleJobType(type)} style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: filters.jobType.includes(type) ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      background: filters.jobType.includes(type) ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: filters.jobType.includes(type) ? 'var(--accent-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}>{type}</button>
                  ))}
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: filters.experience ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 700 }}>EXP:</span>
                  <select className="form-input" value={filters.experience} onChange={e => setFilters({ ...filters, experience: e.target.value })}
                    style={{ 
                      fontSize: 12, padding: '4px 10px', height: 32, borderRadius: 8, width: 150,
                      border: filters.experience ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                      background: filters.experience ? 'rgba(99,102,241,0.1)' : undefined,
                      color: filters.experience ? 'var(--accent-primary)' : undefined,
                      fontWeight: filters.experience ? 700 : undefined,
                    }}>
                    {EXPERIENCE_LEVELS.map(el => <option key={el.value} value={el.value}>{el.label}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>SALARY:</span>
                  <select className="form-input" value={filters.salaryMin} onChange={e => setFilters({ ...filters, salaryMin: e.target.value })}
                    style={{ fontSize: 12, padding: '4px 10px', height: 32, borderRadius: 8, width: 120 }}>
                    {SALARY_RANGES.map(sr => <option key={sr.value} value={sr.value}>{sr.label}</option>)}
                  </select>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>SORT:</span>
                  <select className="form-input" value={sortBy} onChange={e => setSortBy(e.target.value)}
                    style={{ fontSize: 12, padding: '4px 10px', height: 32, borderRadius: 8, width: 130 }}>
                    <option value="relevance">Relevance</option>
                    <option value="newest">Newest First</option>
                    <option value="salary-high">Salary (High-Low)</option>
                  </select>
                </div>
              </div>
            </form>
          </div>

          {/* Results Info */}
          {!loading && jobs.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{jobs.length}</span>
              <span>individual jobs shown</span>
              {total > jobs.length && (
                <><span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                <span style={{ color: 'var(--text-muted)' }}>{total} total found</span></>
              )}
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
              <span>Searching: <strong style={{ color: 'var(--text-secondary)' }}>{lastSearch.query}</strong> in <strong style={{ color: 'var(--text-secondary)' }}>{lastSearch.location}</strong></span>
            </div>
          )}

          {/* Job Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
                <img 
                  src="https://img.pikbest.com/png-images/20190918/cartoon-snail-loading-loading-gif-animation_2734139.png!bw700"
                  alt="Searching jobs..."
                  style={{ width: 120, height: 120, objectFit: 'contain' }}
                />
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Searching across all job portals...</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>This may take a few seconds</div>
              </div>
            ) : sortedJobs.length === 0 ? (
              <div className="card" style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{jobs.length === 0 && !lastSearch.query ? '🔍' : '😕'}</div>
                <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {jobs.length === 0 && !lastSearch.query
                    ? 'Search for jobs above to get started'
                    : 'No jobs found matching your filters. Try adjusting your search or experience level.'}
                </p>
              </div>
            ) : (
              sortedJobs.map(job => <JobCard key={job.id} job={job} router={router} onViewDetails={handleViewDetails} />)
            )}
          </div>

          {/* Load More */}
          {!loading && hasMore && (
            <div style={{ textAlign: 'center', paddingBottom: 32 }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleSearch(null, false)}
                disabled={loadingMore}
                style={{ padding: '12px 40px', borderRadius: 12, fontWeight: 700, fontSize: 15 }}
              >
                {loadingMore ? (
                  <><span className="spinner" style={{ marginRight: 8 }} /> Loading more jobs...</>
                ) : (
                  '⬇ Load More Jobs'
                )}
              </button>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Showing {jobs.length} of {total} jobs
              </div>
            </div>
          )}

          {!loading && !hasMore && jobs.length > 0 && (
            <div style={{ textAlign: 'center', paddingBottom: 24, color: 'var(--text-muted)', fontSize: 13 }}>
              ✓ All {jobs.length} jobs loaded
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function JobCard({ job, router, onViewDetails }) {
  const sourceColor = getSourceColor(job.source);
  const isGoodJob = job.noLoginRequired !== false;

  return (
    <div
      className="card"
      onClick={() => {
        if (!job.url || job.url === '#') return;
        localStorage.setItem('jh_prefill_url', job.url);
        localStorage.setItem('jh_prefill_job_preview', JSON.stringify({
          title: job.title,
          company: job.company,
          location: job.location,
          salary: job.salary,
        }));
        router.push('/job-fetcher');
      }}
      style={{
        padding: '20px 24px',
        borderRadius: 18,
        border: '1px solid var(--border)',
        background: 'var(--bg-card)',
        display: 'flex',
        gap: 20,
        alignItems: 'flex-start',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
        cursor: job.url && job.url !== '#' ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.border = `1px solid ${sourceColor}60`;
        e.currentTarget.style.transform = 'translateX(4px)';
        e.currentTarget.style.boxShadow = `0 4px 20px ${sourceColor}15`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = '1px solid var(--border)';
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Left accent bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: sourceColor, borderRadius: '18px 0 0 18px' }} />

      {/* Company Logo / Icon */}
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: `${sourceColor}18`,
        border: `1px solid ${sourceColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, overflow: 'hidden',
      }}>
        {job.logo ? (
          <img src={job.logo} alt={job.company} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          job.company?.[0]?.toUpperCase() || '🏢'
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, margin: 0 }}>
            {job.title}
          </h3>
          {isGoodJob && (
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
              background: 'rgba(16,185,129,0.12)', color: 'var(--accent-emerald)',
              border: '1px solid rgba(16,185,129,0.2)', whiteSpace: 'nowrap',
              flexShrink: 0
            }}>NO LOGIN</span>
          )}
        </div>

        {/* Company */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
          {job.company}
        </div>

        {/* Tags row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {job.location && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              📍 {job.location}
            </span>
          )}
          {job.type && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
              background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)',
              border: '1px solid rgba(99,102,241,0.15)'
            }}>{job.type}</span>
          )}
          {job.salary && job.salary !== 'Competitive' && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700,
              background: 'rgba(16,185,129,0.1)', color: 'var(--accent-emerald)',
              border: '1px solid rgba(16,185,129,0.15)'
            }}>💰 {job.salary}</span>
          )}
        </div>

        {/* Description */}
        {job.description && (
          <p style={{
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
          }}>
            {job.description}
          </p>
        )}
      </div>

      {/* Right Side Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
        {/* Source badge */}
        <span style={{
          fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 6,
          background: `${sourceColor}20`, color: sourceColor,
          border: `1px solid ${sourceColor}40`,
          whiteSpace: 'nowrap',
        }}>{job.source?.toUpperCase()}</span>

        {/* Posted date */}
        {job.posted && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{job.posted}</span>
        )}

        {/* Apply Button */}
        {job.url && job.url !== '#' && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(job);
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: `linear-gradient(135deg, ${sourceColor}, ${sourceColor}cc)`,
              color: '#fff', textDecoration: 'none',
              boxShadow: `0 4px 12px ${sourceColor}30`,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Apply Now ↗
          </a>
        )}
      </div>
    </div>
  );
}

