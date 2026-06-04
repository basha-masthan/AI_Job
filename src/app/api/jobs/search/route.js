import { NextResponse } from 'next/server';
import { getApiKey } from '@/lib/config';

const PAGE_SIZE = 10;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query        = searchParams.get('query') || 'Software Engineer';
  const cityFilter   = searchParams.get('location') || 'India';
  const experience   = searchParams.get('experience') || '';
  const isRemote     = searchParams.get('remote') === 'true';
  const salaryMin    = searchParams.get('salary_min') || '';
  const jobTypeParam = searchParams.get('job_type') || '';
  const page         = parseInt(searchParams.get('page') || '1', 10);

  const keys = {
    RAPID_LINKEDIN: process.env['RAPIDAPI_KEY_1']?.trim() || getApiKey('RAPIDAPI_KEY_1')?.trim(),
    RAPID_JSEARCH: process.env['RAPIDAPI_KEY_2']?.trim() || getApiKey('RAPIDAPI_KEY_2')?.trim(),
    RAPID_GLASSDOOR: process.env['RAPIDAPI_KEY_3']?.trim() || getApiKey('RAPIDAPI_KEY_3')?.trim(),
    RAPID_INDEED: process.env['RAPIDAPI_KEY_4']?.trim() || getApiKey('RAPIDAPI_KEY_4')?.trim(),
    RAPID_ACTIVE: process.env['RAPIDAPI_KEY_5']?.trim() || getApiKey('RAPIDAPI_KEY_5')?.trim(),
    ADZUNA_ID:   getApiKey('ADZUNA_APP_ID')?.trim(),
    ADZUNA_KEY:  getApiKey('ADZUNA_APP_KEY')?.trim(),
    REMOTIVE_API: getApiKey('REMOTIVE_API')?.trim(),
  };

  // Run all sources in parallel
  const [jsearchJobs, activeJobsDbJobs, linkedinApiJobs, indeedApiJobs, glassdoorApiJobs, adzunaJobs, arbeitnowJobs, remotiveJobs] = await Promise.all([
    fetchJSearchJobs(query, cityFilter, experience, isRemote, jobTypeParam, page, keys),
    fetchActiveJobsDB(query, cityFilter, page, keys),
    fetchLinkedInJobSearchAPI(query, cityFilter, page, keys),
    fetchIndeedJobsAPI(query, cityFilter, page, keys),
    fetchGlassdoorJobsAPI(query, cityFilter, page, keys),
    fetchAdzunaJobs(query, cityFilter, experience, isRemote, salaryMin, page, keys),
    page === 1 ? fetchArbeitnowJobs(query) : Promise.resolve([]),
    isRemote ? fetchRemotiveJobs(query, keys) : Promise.resolve([]),
  ]);

  let allJobs = [...jsearchJobs, ...activeJobsDbJobs, ...linkedinApiJobs, ...indeedApiJobs, ...glassdoorApiJobs, ...adzunaJobs, ...arbeitnowJobs, ...remotiveJobs];


  // Deduplicate by URL
  const seen = new Set();
  allJobs = allJobs.filter(job => {
    if (!job.url || job.url === '#' || seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });

  // Filter dynamically so that only exact matching job roles are returned
  if (query && query.trim() !== '') {
    const qClean = query.toLowerCase().trim();
    const stopwords = new Set(['jobs', 'hiring', 'opportunity', 'in', 'remote', 'fulltime', 'parttime', 'fresher', 'internship', 'intern']);
    const queryTerms = qClean.split(/\s+/).filter(w => w.length > 1 && !stopwords.has(w));
    
    if (queryTerms.length > 0) {
      allJobs = allJobs.filter(job => {
        const title = (job.title || '').toLowerCase();
        const matchesTitle = queryTerms.some(term => {
          if (term === 'data') return title.includes('data') || title.includes('analytics') || title.includes('analysis');
          return title.includes(term);
        });
        return matchesTitle;
      });
    }
  }

  // Filter out aggregator/search page links — only allow direct individual job links
  allJobs = allJobs.filter(job => {
    try {
      const u = new URL(job.url);
      const path = u.pathname;
      // Reject search-result pages (those ending in -jobs, /jobs/search, /jobs?q= etc.)
      const isSearchPage = /\/(jobs\/search|jobs\/listing|jobs\/results|\?q=|\?search=)/.test(u.href) ||
                           /[-_]jobs\/?$/.test(path) ||
                           (/\/jobs\/?$/.test(path) && !path.match(/\/jobs\/\d+|\/jobs\/view\//));
      return !isSearchPage;
    } catch {
      return false;
    }
  });

  // Prioritize LinkedIn, Indeed, and Glassdoor
  const getPriorityScore = (job) => {
    const src = (job.source || '').toLowerCase();
    const urlStr = (job.url || '').toLowerCase();
    
    if (src.includes('linkedin') || urlStr.includes('linkedin.com')) {
      return 3;
    }
    if (src.includes('indeed') || urlStr.includes('indeed.com')) {
      return 2;
    }
    if (src.includes('glassdoor') || urlStr.includes('glassdoor.com')) {
      return 1;
    }
    return 0;
  };

  allJobs.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

  // ── Experience Level Filter (enforced server-side) ──
  if (experience && experience.trim() !== '') {
    const parts = experience.split('-').map(s => parseInt(s));
    const filterMin = parts[0] || 0;
    const filterMax = parts[1] || filterMin + 10;

    // Helper: parse years from job experience string
    const parseExpRange = (expStr) => {
      if (!expStr || typeof expStr !== 'string') return null;
      const t = expStr.toLowerCase();

      // Fresher / entry level keywords → treat as 0-1 years
      if (/fresher|entry[\s-]level|0\s*years?|no\s*exp|graduate/i.test(t)) {
        return { min: 0, max: 1 };
      }

      // "X+ years" pattern
      const plusMatch = t.match(/(\d+)\s*\+\s*years?/);
      if (plusMatch) {
        const n = parseInt(plusMatch[1]);
        return { min: n, max: n + 8 };
      }

      // "X-Y years" or "X to Y years" pattern
      const rangeMatch = t.match(/(\d+)[\s-–]+(?:to\s+)?(\d+)\s*(?:years?|yrs?)/);
      if (rangeMatch) {
        return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
      }

      // Single number like "3 years"
      const singleMatch = t.match(/(\d+)\s*(?:years?|yrs?)/);
      if (singleMatch) {
        const n = parseInt(singleMatch[1]);
        return { min: Math.max(0, n - 1), max: n + 2 };
      }

      return null;
    };

    allJobs = allJobs.filter(job => {
      const jobExpRange = parseExpRange(job.experience);

      // If job has no experience field, be lenient — include it
      if (!jobExpRange) return true;

      // Overlap check: job's exp range overlaps with filter range
      return jobExpRange.max >= filterMin && jobExpRange.min <= filterMax;
    });
  }


  // Enforce page size for lazy loading
  const total = allJobs.length;
  const paginated = allJobs.slice(0, PAGE_SIZE);


  if (paginated.length === 0) {
    // Fallback: return curated mock with real individual job links
    return NextResponse.json({
      jobs: getMockJobs(query, cityFilter),
      total: 2,
      page,
      hasMore: false,
      fallback: true
    });
  }

  return NextResponse.json({
    jobs: paginated,
    total,
    page,
    hasMore: total > PAGE_SIZE,
  });
}

// ── JSearch (RapidAPI) — Best source for real individual Indian jobs ──
async function fetchJSearchJobs(query, location, experience, isRemote, jobType, page, keys) {
  if (!keys.RAPID_JSEARCH) return [];
  try {
    const locationStr = isRemote ? 'India remote' : location;

    // Map experience range to a descriptive keyword for better API results
    let expKeyword = '';
    if (experience) {
      const [minExp] = experience.split('-').map(Number);
      if (minExp === 0) expKeyword = 'fresher entry level';
      else if (minExp <= 3) expKeyword = 'junior';
      else if (minExp <= 5) expKeyword = 'mid-level';
      else expKeyword = 'senior';
    }

    const q = expKeyword
      ? `${expKeyword} ${query} jobs in ${locationStr}`
      : `${query} jobs in ${locationStr}`;
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(q)}&num_pages=1&page=${page}&date_posted=month`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': keys.RAPID_JSEARCH,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .filter(j => j.job_apply_link && !j.job_apply_link.includes('jsearch'))
      .map((j, i) => ({
        id: `jsearch-${j.job_id || i}`,
        title: j.job_title,
        company: j.employer_name,
        location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || 'India',
        description: (j.job_description || '').replace(/<[^>]*>/g, '').substring(0, 400),
        url: j.job_apply_link,
        salary: j.job_min_salary
          ? `₹${Number(j.job_min_salary).toLocaleString()} – ₹${Number(j.job_max_salary || j.job_min_salary * 1.3).toLocaleString()} ${j.job_salary_period || ''}`
          : 'Competitive',
        posted: j.job_posted_at_datetime_utc
          ? formatPosted(j.job_posted_at_datetime_utc)
          : 'Recent',
        type: j.job_employment_type || '',
        source: j.job_publisher || 'JSearch',
        logo: j.employer_logo || null,
        noLoginRequired: !!j.job_apply_link,
        // Extract experience requirement from job description for filtering
        experience: extractExperience(j.job_description || ''),
      }));
  } catch (e) {
    console.warn('[JSearch] Error:', e.message);
    return [];
  }
}

// ── Adzuna — Reliable with real individual links ──
async function fetchAdzunaJobs(query, location, experience, isRemote, salaryMin, page, keys) {
  if (!keys.ADZUNA_ID || !keys.ADZUNA_KEY || keys.ADZUNA_ID === 'your_adzuna_app_id') return [];
  try {
    let url = `https://api.adzuna.com/v1/api/jobs/in/search/${page}` +
      `?app_id=${keys.ADZUNA_ID}&app_key=${keys.ADZUNA_KEY}` +
      `&results_per_page=${PAGE_SIZE}` +
      `&what=${encodeURIComponent(query)}` +
      `&content-type=application/json`;

    if (location && location.toLowerCase() !== 'india') {
      url += `&where=${encodeURIComponent(location)}`;
    }
    if (salaryMin) url += `&salary_min=${salaryMin}`;
    if (isRemote)  url += `&what_and=remote`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((j, i) => ({
      id: `adz-${j.id || i}`,
      title: j.title,
      company: j.company?.display_name || 'Company',
      location: j.location?.display_name || 'India',
      description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 400),
      url: j.redirect_url,
      salary: j.salary_min
        ? `₹${Math.round(j.salary_min / 12).toLocaleString()}/mo`
        : 'Competitive',
      posted: j.created ? formatPosted(j.created) : 'Recent',
      type: j.contract_time ? (j.contract_time === 'full_time' ? 'Full-Time' : 'Part-Time') : '',
      source: 'Adzuna',
      logo: null,
      noLoginRequired: true,
    }));
  } catch (e) {
    console.warn('[Adzuna] Error:', e.message);
    return [];
  }
}

// ── Arbeitnow — Free API, no key needed, tech jobs ──
async function fetchArbeitnowJobs(query) {
  try {
    const res = await fetch(
      `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .filter(j => j.url && j.remote !== undefined)
      .slice(0, 5)
      .map((j, i) => ({
        id: `arb-${j.slug || i}`,
        title: j.title,
        company: j.company_name,
        location: j.location || (j.remote ? 'Remote' : 'India'),
        description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 400),
        url: j.url,
        salary: 'Competitive',
        posted: 'Recent',
        type: j.job_types?.join(', ') || (j.remote ? 'Remote' : 'Full-Time'),
        source: 'Arbeitnow',
        logo: null,
        noLoginRequired: true,
      }));
  } catch (e) {
    console.warn('[Arbeitnow] Error:', e.message);
    return [];
  }
}

// ── Remotive — Good for remote roles ──
async function fetchRemotiveJobs(query, keys) {
  if (!keys.REMOTIVE_API) return [];
  try {
    const res = await fetch(
      `${keys.REMOTIVE_API}?search=${encodeURIComponent(query)}&limit=5`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map((j, i) => ({
      id: `rem-${j.id || i}`,
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || 'Remote',
      description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 400),
      url: j.url,
      salary: j.salary || 'Competitive',
      posted: j.publication_date ? formatPosted(j.publication_date) : 'Recent',
      type: 'Remote',
      source: 'Remotive',
      logo: j.company_logo || null,
      noLoginRequired: true,
    }));
  } catch (e) {
    console.warn('[Remotive] Error:', e.message);
    return [];
  }
}

// Extract experience string from a job description text
function extractExperience(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  // Check fresher/entry-level keywords first
  if (/\b(fresher|fresh\s+graduate|0\s*[–-]\s*1\s*year|entry[\s-]level|no\s+experience\s+required)\b/.test(t)) {
    return '0-1 years';
  }

  // Look for "X-Y years" or "X to Y years" patterns
  const rangeMatch = t.match(/(\d+)\s*(?:–|-|to)\s*(\d+)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience)?/);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]} years`;
  }

  // Look for "X+ years" pattern
  const plusMatch = t.match(/(\d+)\s*\+\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience)?/);
  if (plusMatch) {
    return `${plusMatch[1]}+ years`;
  }

  // Look for "minimum X years" pattern
  const minMatch = t.match(/(?:minimum|min|at\s+least)\s+(\d+)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience)?/);
  if (minMatch) {
    return `${minMatch[1]}+ years`;
  }

  return null;
}

function formatPosted(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return 'Recent';
  }
}

function getMockJobs(query, location) {
  return [
    {
      id: 'mock-1',
      title: `Senior ${query}`,
      company: 'TechCorp India',
      location: location || 'Bengaluru, India',
      description: 'We are looking for a highly motivated engineer to join our growing team. You will work on cutting-edge products and collaborate with top engineers.',
      url: `https://cutshort.io/jobs/${encodeURIComponent(query.toLowerCase().replace(/ /g, '-'))}-jobs`,
      salary: '₹12L – ₹20L / yr',
      posted: 'Today',
      type: 'Full-Time',
      source: 'CutShort',
      logo: null,
      noLoginRequired: true,
    },
    {
      id: 'mock-2',
      title: `${query} - Fresher`,
      company: 'Startup Hub',
      location: 'Remote',
      description: 'Great opportunity for freshers eager to make a mark in tech. We offer excellent mentorship and fast career growth.',
      url: `https://internshala.com/jobs/keyword-${encodeURIComponent(query.toLowerCase().replace(/ /g, '-'))}`,
      salary: '₹4L – ₹6L / yr',
      posted: '2 days ago',
      type: 'Full-Time',
      source: 'Internshala',
      logo: null,
      noLoginRequired: true,
    },
  ];
}

async function fetchActiveJobsDB(query, location, page, keys) {
  if (!keys.RAPID_ACTIVE) return [];
  try {
    const locationStr = location || 'India';
    const offset = (page - 1) * 10;
    const url = `https://active-jobs-db.p.rapidapi.com/active-ats-1h?offset=${offset}&title_filter=${encodeURIComponent(query)}&location_filter=${encodeURIComponent(locationStr)}&description_type=text`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': keys.RAPID_ACTIVE,
        'X-RapidAPI-Host': 'active-jobs-db.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.results || data.data || []);
    return list.map((j, i) => {
      const jobUrl = j.url || j.job_apply_link || j.apply_link || j.link || '#';
      return {
        id: `activejobs-${j.id || j.job_id || i}`,
        title: j.title || j.job_title || 'Software Engineer',
        company: j.company || j.company_name || j.employer_name || 'Company',
        location: j.location || j.job_location || locationStr,
        description: (j.description || j.job_description || '').substring(0, 400),
        url: jobUrl,
        salary: j.salary || j.job_salary || 'Competitive',
        posted: j.posted || j.post_date || j.job_posted_at || 'Recent',
        type: j.type || j.job_employment_type || 'Full-Time',
        source: j.source || 'Active Jobs DB',
        logo: j.logo || j.company_logo || null,
        noLoginRequired: true,
      };
    });
  } catch (e) {
    console.warn('[Active Jobs DB] Error:', e.message);
    return [];
  }
}

async function fetchLinkedInJobSearchAPI(query, location, page, keys) {
  if (!keys.RAPID_LINKEDIN) return [];
  try {
    const locationStr = location || 'India';
    const offset = (page - 1) * 10;
    const url = `https://linkedin-job-search-api.p.rapidapi.com/active-jb-1h?offset=${offset}&title_filter=${encodeURIComponent(query)}&location_filter=${encodeURIComponent(locationStr)}&description_type=text`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': keys.RAPID_LINKEDIN,
        'X-RapidAPI-Host': 'linkedin-job-search-api.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.results || data.data || []);
    return list.map((j, i) => {
      const jobUrl = j.url || j.job_apply_link || j.apply_link || j.link || '#';
      return {
        id: `linkedin-api-${j.id || j.job_id || i}`,
        title: j.title || j.job_title || 'Software Engineer',
        company: j.company || j.company_name || j.employer_name || 'Company',
        location: j.location || j.job_location || locationStr,
        description: (j.description || j.job_description || '').substring(0, 400),
        url: jobUrl,
        salary: j.salary || j.job_salary || 'Competitive',
        posted: j.posted || j.post_date || j.job_posted_at || 'Recent',
        type: j.type || j.job_employment_type || 'Full-Time',
        source: 'LinkedIn',
        logo: j.logo || j.company_logo || null,
        noLoginRequired: true,
      };
    });
  } catch (e) {
    console.warn('[LinkedIn Job Search API] Error:', e.message);
    return [];
  }
}

async function fetchIndeedJobsAPI(query, location, page, keys) {
  if (!keys.RAPID_INDEED) return [];
  try {
    const locationStr = location || 'India';
    const url = `https://indeed12.p.rapidapi.com/jobs/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(locationStr)}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': keys.RAPID_INDEED,
        'X-RapidAPI-Host': 'indeed12.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.results || data.data || data.jobs || []);
    return list.map((j, i) => {
      const jobUrl = j.url || j.job_apply_link || j.apply_link || j.link || '#';
      return {
        id: `indeed-api-${j.id || j.job_id || i}`,
        title: j.title || j.job_title || 'Software Engineer',
        company: j.company || j.company_name || j.employer_name || 'Company',
        location: j.location || j.job_location || locationStr,
        description: (j.description || j.job_description || '').substring(0, 400),
        url: jobUrl,
        salary: j.salary || j.job_salary || 'Competitive',
        posted: j.posted || j.post_date || j.job_posted_at || 'Recent',
        type: j.type || j.job_employment_type || 'Full-Time',
        source: 'Indeed',
        logo: j.logo || j.company_logo || null,
        noLoginRequired: true,
      };
    });
  } catch (e) {
    console.warn('[Indeed API] Error:', e.message);
    return [];
  }
}

async function fetchGlassdoorJobsAPI(query, location, page, keys) {
  if (!keys.RAPID_GLASSDOOR) return [];
  try {
    const locationStr = location || 'India';
    const url = `https://glassdoor-real-time.p.rapidapi.com/jobs/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(locationStr)}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': keys.RAPID_GLASSDOOR,
        'X-RapidAPI-Host': 'glassdoor-real-time.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.results || data.data || data.jobs || []);
    return list.map((j, i) => {
      const jobUrl = j.url || j.job_apply_link || j.apply_link || j.link || '#';
      return {
        id: `glassdoor-api-${j.id || j.job_id || i}`,
        title: j.title || j.job_title || 'Software Engineer',
        company: j.company || j.company_name || j.employer_name || 'Company',
        location: j.location || j.job_location || locationStr,
        description: (j.description || j.job_description || '').substring(0, 400),
        url: jobUrl,
        salary: j.salary || j.job_salary || 'Competitive',
        posted: j.posted || j.post_date || j.job_posted_at || 'Recent',
        type: j.type || j.job_employment_type || 'Full-Time',
        source: 'Glassdoor',
        logo: j.logo || j.company_logo || null,
        noLoginRequired: true,
      };
    });
  } catch (e) {
    console.warn('[Glassdoor API] Error:', e.message);
    return [];
  }
}


