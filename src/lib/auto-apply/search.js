import { getApiKey } from '@/lib/config';
import { invokeAI, safeJSONParse, verifyJobContent } from '@/lib/ai';
import { scrapeJobFromUrl } from '@/lib/scraper';
import { v4 as uuid } from 'uuid';

// ── URL Normalization ───────────────────────────────────────────
function normalizeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    u.searchParams.delete('utm_content');
    u.searchParams.delete('ref');
    u.searchParams.delete('source');
    u.hash = '';
    return u.origin + u.pathname + u.search;
  } catch {
    return url;
  }
}

function isIndividualJobUrl(url) {
  if (!url || url === '#' || url.length < 10) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();

    const jobPatterns = [
      /\/jobs\/view\//,
      /\/viewjob\?jk=/,
      /\/campus\/rolesense\//,
      /\/job\/[a-f0-9]{8,}/,
      /\/job-listings?\//,
      /\/job-opening?\//,
      /\/careers?\//,
      /\/position\//,
      /\/apply\//,
      /\/requisition\//,
      /\/posting\//,
      /\/opportunity\//,
    ];

    if (jobPatterns.some(p => p.test(path))) return true;

    const jobDomains = [
      'linkedin.com', 'indeed.com', 'glassdoor.com', 'naukri.com',
      'monster.com', 'dice.com', 'wellfound.com', 'angel.co',
      'ziprecruiter.com', 'simplyhired.com', 'careerbuilder.com',
      'lever.co', 'greenhouse.io', 'workable.com', 'ashbyhq.com',
      'bamboohr.com', 'workday.com', 'myworkdayjobs.com', 'taleo.net',
      'icims.com', 'smartrecruiters.com', 'jobvite.com',
    ];

    if (jobDomains.some(d => host.includes(d))) {
      return /\/\d{6,}/.test(path) || /job/i.test(path);
    }

    return false;
  } catch {
    return false;
  }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return null; }
}

function cleanTitle(title, fallback) {
  if (!title) return fallback;
  let t = title;
  t = t.replace(/\s*[-|]\s*Jobs\s*[-|]?\s*.*/gi, '');
  t = t.replace(/\s*[-|]\s*Hiring\s*[-|]?\s*.*/gi, '');
  t = t.replace(/\s*[-|]\s*LinkedIn.*/gi, '');
  t = t.replace(/\s*[-|]\s*Indeed.*/gi, '');
  t = t.replace(/\s*[-|]\s*Glassdoor.*/gi, '');
  t = t.replace(/\b(hiring|we are hiring|apply now|apply today|new)\b/gi, '');
  t = t.replace(/\s*\([^)]*\)/g, '');
  return t.trim() || fallback;
}

function extractCompanyFromTitle(title, url) {
  if (!title) return null;
  const atMatch = title.match(/\bat\s+([A-Z][a-zA-Z0-9\s.&]+?)(?:\s*[|–—\-\n]|$)/i);
  if (atMatch) return atMatch[1].trim();
  const hiringMatch = title.match(/^([A-Z][a-zA-Z0-9\s.&]+)\s+(?:is hiring|hiring|jobs|careers)/i);
  if (hiringMatch) return hiringMatch[1].trim();
  if (url) {
    try {
      const { hostname } = new URL(url);
      const parts = hostname.replace('www.', '').split('.');
      if (parts[0] && parts[0].length > 2) {
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
    } catch {}
  }
  return null;
}

// ── Query Generation ────────────────────────────────────────────
function generateQueries(targetRole, skills, experienceLevels) {
  const queries = [targetRole];
  const words = targetRole.split(/\s+/);
  const roleCore = words.filter(w =>
    !['senior', 'junior', 'lead', 'principal', 'staff', 'entry', 'level', 'fresher']
      .includes(w.toLowerCase())
  ).join(' ');
  if (roleCore && roleCore !== targetRole) queries.push(roleCore);
  if (skills && skills.length > 0) {
    const skillStr = skills.slice(0, 3).join(' ');
    queries.push(`${roleCore} ${skillStr}`);
    if (words.length <= 2) queries.push(`${words[0]} ${skillStr}`);
  }
  const seniority = experienceLevels.includes('fresher') || experienceLevels.includes('0-1') || experienceLevels.includes('0-2')
    ? 'junior' : experienceLevels.includes('5+') ? '' : '';
  if (seniority && !words.some(w => w.toLowerCase() === seniority)) {
    queries.unshift(`${seniority} ${roleCore}`);
  }
  return [...new Set(queries)].slice(0, 4);
}

// ═════════════════════════════════════════════════════════════════
// PHASE 1 — RapidAPI Sources
// ═════════════════════════════════════════════════════════════════

async function fetchJSearch(query, location) {
  const key = getApiKey('RAPIDAPI_KEY_2') || getApiKey('RAPIDAPI_KEY');
  if (!key) return [];
  try {
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query + ' ' + location)}&num_pages=1&page=1&date_posted=month&num_results=15`;
    const res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) { console.warn('[JSearch] rate limited'); return []; }
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(j => ({
      url: j.job_apply_link || '#',
      title: cleanTitle(j.job_title, query),
      company: j.employer_name || null,
      description: (j.job_description || '').replace(/<[^>]*>/g, '').substring(0, 400),
      location: [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ') || location,
      source: 'jsearch',
      date: j.job_posted_at_datetime_utc || '',
    }));
  } catch (e) { console.warn('[JSearch]', e.message); return []; }
}

async function fetchLinkedInAPI(query, location) {
  const key = getApiKey('RAPIDAPI_KEY_1');
  if (!key) return [];
  try {
    const url = `https://linkedin-job-search-api.p.rapidapi.com/active-jb-1h?offset=0&title_filter=${encodeURIComponent(query)}&location_filter=${encodeURIComponent(location)}&description_type=text`;
    const res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'linkedin-job-search-api.p.rapidapi.com' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) { console.warn('[LinkedInAPI] rate limited'); return []; }
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.results || data.data || data.jobs || [];
    return (Array.isArray(list) ? list : []).map(j => ({
      url: j.url || j.job_apply_link || j.link || '#',
      title: cleanTitle(j.title || j.job_title, query),
      company: j.company || j.company_name || j.employer_name || null,
      description: (j.description || j.job_description || '').substring(0, 400),
      location: j.location || j.job_location || location,
      source: 'linkedin',
      date: j.posted || j.post_date || j.job_posted_at || '',
    }));
  } catch (e) { console.warn('[LinkedInAPI]', e.message); return []; }
}

async function fetchIndeedAPI(query, location) {
  const key = getApiKey('RAPIDAPI_KEY_4');
  if (!key) return [];
  try {
    const url = `https://indeed12.p.rapidapi.com/jobs/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&page=1`;
    const res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'indeed12.p.rapidapi.com' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) { console.warn('[IndeedAPI] rate limited'); return []; }
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.results || data.data || data.jobs || [];
    return (Array.isArray(list) ? list : []).map(j => ({
      url: j.url || j.job_apply_link || j.link || '#',
      title: cleanTitle(j.title || j.job_title, query),
      company: j.company || j.company_name || j.employer_name || null,
      description: (j.description || j.job_description || '').substring(0, 400),
      location: j.location || j.job_location || location,
      source: 'indeed',
      date: j.posted || j.post_date || j.job_posted_at || '',
    }));
  } catch (e) { console.warn('[IndeedAPI]', e.message); return []; }
}

async function fetchGlassdoorAPI(query, location) {
  const key = getApiKey('RAPIDAPI_KEY_3');
  if (!key) return [];
  try {
    const url = `https://glassdoor-real-time.p.rapidapi.com/jobs/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&page=1`;
    const res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'glassdoor-real-time.p.rapidapi.com' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) { console.warn('[GlassdoorAPI] rate limited'); return []; }
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.results || data.data || data.jobs || data.data?.jobs || [];
    return (Array.isArray(list) ? list : []).map(j => ({
      url: j.url || j.job_apply_link || j.link || '#',
      title: cleanTitle(j.title || j.job_title, query),
      company: j.company || j.company_name || j.employer_name || null,
      description: (j.description || j.job_description || '').substring(0, 400),
      location: j.location || j.job_location || location,
      source: 'glassdoor',
      date: j.posted || j.post_date || j.job_posted_at || '',
    }));
  } catch (e) { console.warn('[GlassdoorAPI]', e.message); return []; }
}

async function fetchActiveJobsDB(query, location) {
  const key = getApiKey('RAPIDAPI_KEY_5');
  if (!key) return [];
  try {
    const url = `https://active-jobs-db.p.rapidapi.com/active-ats-1h?offset=0&title_filter=${encodeURIComponent(query)}&location_filter=${encodeURIComponent(location)}&description_type=text`;
    const res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'active-jobs-db.p.rapidapi.com' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 429) { console.warn('[ActiveJobsDB] rate limited'); return []; }
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.results || data.data || data.jobs || [];
    return (Array.isArray(list) ? list : []).map(j => ({
      url: j.url || j.job_apply_link || j.link || '#',
      title: cleanTitle(j.title || j.job_title, query),
      company: j.company || j.company_name || j.employer_name || null,
      description: (j.description || j.job_description || '').substring(0, 400),
      location: j.location || j.job_location || location,
      source: 'active-jobs',
      date: j.posted || j.post_date || j.job_posted_at || '',
    }));
  } catch (e) { console.warn('[ActiveJobsDB]', e.message); return []; }
}

// ═════════════════════════════════════════════════════════════════
// PHASE 1 — Site-Restricted Serper (targets individual job pages)
// ═════════════════════════════════════════════════════════════════

async function searchSiteRestrictedSerper(query, location) {
  const key = getApiKey('SERPER_API_KEY') || process.env.SERPER_API_KEY;
  if (!key) return [];

  const siteQueries = [
    `site:linkedin.com/jobs/view "${query}" ${location}`,
    `site:in.indeed.com/viewjob "${query}" ${location}`,
    `site:naukri.com (campus/rolesense | job-list) "${query}" ${location}`,
    `site:glassdoor.com/job-listing "${query}" ${location}`,
  ];

  const results = [];
  const seen = new Set();

  for (const sq of siteQueries) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: sq, num: 5 }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      for (const item of data.organic || []) {
        const url = item.link;
        if (!url || seen.has(url) || !isIndividualJobUrl(url)) continue;
        seen.add(url);
        results.push({
          url,
          title: cleanTitle(item.title, query),
          company: extractCompanyFromTitle(item.title, url),
          description: item.snippet || '',
          location: location,
          source: 'serper',
          date: item.date || '',
        });
      }
    } catch {}
  }
  return results;
}

// ═════════════════════════════════════════════════════════════════
// PHASE 1 — Discover candidate URLs from all sources
// ═════════════════════════════════════════════════════════════════

async function phase1Discovery({ targetRole, targetLocation, experienceLevels, skills }) {
  const queries = generateQueries(targetRole, skills, experienceLevels);
  const ops = [];

  for (const q of queries) {
    ops.push(fetchJSearch(q, targetLocation));
    ops.push(fetchLinkedInAPI(q, targetLocation));
    ops.push(fetchIndeedAPI(q, targetLocation));
    ops.push(fetchGlassdoorAPI(q, targetLocation));
    ops.push(fetchActiveJobsDB(q, targetLocation));
    ops.push(searchSiteRestrictedSerper(q, targetLocation));
  }

  const rawResults = await Promise.allSettled(ops);

  const seen = new Set();
  const candidates = [];

  for (const r of rawResults) {
    if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
    for (const job of r.value) {
      const url = normalizeUrl(job.url);
      if (!url || url === '#' || seen.has(url)) continue;
      if (!isIndividualJobUrl(url)) continue;
      seen.add(url);
      candidates.push({
        ...job,
        id: uuid(),
        url: url,
        company: job.company || extractCompanyFromTitle(job.title, url) || null,
      });
    }
  }

  return candidates;
}

// ═════════════════════════════════════════════════════════════════
// PHASE 2 — Scrape each URL and AI-verify it's a real job posting
// ═════════════════════════════════════════════════════════════════

async function phase2ScrapeAndVerify(candidates, progressFn, isActive) {
  const verified = [];
  const MAX_CONCURRENT = 5;
  const results = [];
  const total = candidates.length;

  progressFn?.('scraping', `Scraping ${total} job URLs for verification...`, 0, total);

  for (let i = 0; i < candidates.length; i += MAX_CONCURRENT) {
    if (isActive && !isActive()) break;

    const batch = candidates.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.allSettled(
      batch.map(async (candidate) => {
        try {
          const scraped = await scrapeJobFromUrl(candidate.url);
          if (!scraped || !scraped.success) {
            return { ...candidate, verified: false, verifyError: scraped?.error || 'scrape_failed' };
          }

          const aiResult = await verifyJobContent(scraped.text, candidate.url);

          if (aiResult.valid) {
            return {
              ...candidate,
              verified: true,
              title: aiResult.title || candidate.title,
              company: aiResult.company || candidate.company || scraped.company,
              description: aiResult.description || scraped.text.substring(0, 5000),
              experience: aiResult.experience || null,
              skills: aiResult.skills || [],
              location: aiResult.location || candidate.location,
              hiringEmail: aiResult.email || null,
              scrapedText: scraped.text.substring(0, 5000),
            };
          }

          const botPatterns = ['security check', 'security verification', 'verify you are a human', 'cf-browser-verification', 'just a moment'];
          const isBotPage = botPatterns.some(p => scraped.text.toLowerCase().includes(p));

          if (!isBotPage && scraped.text.length > 1000 && !scraped.text.toLowerCase().includes('search results')) {
            return {
              ...candidate,
              verified: true,
              title: candidate.title,
              company: candidate.company || scraped.company,
              description: scraped.text.substring(0, 5000),
              scrapedText: scraped.text.substring(0, 5000),
            };
          }

          return { ...candidate, verified: false, verifyError: 'ai_rejected' };
        } catch (err) {
          return { ...candidate, verified: false, verifyError: err.message };
        }
      })
    );

    for (const br of batchResults) {
      if (br.status === 'fulfilled' && br.value) {
        results.push(br.value);
      }
    }

    progressFn?.('scraping', `Verified ${results.length}/${total} URLs...`, results.length, total);
  }

  for (const r of results) {
    if (r.verified) {
      verified.push({
        id: r.id,
        title: r.title || 'Unknown Position',
        company: r.company || 'Unknown Company',
        source: r.source || 'unknown',
        url: r.url,
        location: r.location || 'India',
        description: r.description || '',
        date: r.date || '',
        companyDomain: extractDomain(r.url),
        experience: r.experience || null,
        skills: r.skills || [],
        hiringEmail: r.hiringEmail || null,
        score: 0,
        status: 'pending',
      });
    }
  }

  const failed = results.filter(r => !r.verified).length;
  progressFn?.('scraping', `Scrape complete: ${verified.length} verified, ${failed} failed`, verified.length, total);

  return { verified, failed, total };
}

// ═════════════════════════════════════════════════════════════════
// MAIN ENTRY
// ═════════════════════════════════════════════════════════════════

export async function searchJobs(args, progressFn, isActive) {
  const { targetRole, targetLocation = 'India', experienceLevels = [], skills = [] } = args;

  // Phase 1: Discover candidate URLs
  progressFn?.('discovering', `Searching ${targetRole} jobs across LinkedIn, Indeed, Glassdoor, Naukri...`, 0, 0);
  const candidates = await phase1Discovery({ targetRole, targetLocation, experienceLevels, skills });

  if (candidates.length === 0) {
    return { jobs: [], queries: [], stats: {}, message: 'No job URLs found from any source. Try broader search terms or check API keys.' };
  }

  // Phase 2: Scrape + verify all candidates
  const { verified, failed } = await phase2ScrapeAndVerify(candidates, progressFn, isActive);

  if (verified.length === 0) {
    return { jobs: [], queries: [], stats: {}, message: `Found ${candidates.length} URLs but none passed verification (${failed} failed).` };
  }

  const stats = {};
  for (const j of verified) stats[j.source] = (stats[j.source] || 0) + 1;

  return {
    jobs: verified,
    queries: generateQueries(targetRole, skills, experienceLevels),
    stats,
    message: `Found ${verified.length} verified jobs (${failed} URLs rejected)`,
  };
}
