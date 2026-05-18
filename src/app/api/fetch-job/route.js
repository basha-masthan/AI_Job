import { NextResponse } from 'next/server';
import { scrapeJobFromUrl } from '@/lib/scraper';
import { extractJobDetails, invokeAI, safeJSONParse } from '@/lib/ai';
import { getApiKey } from '@/lib/config';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    let targetUrl = url;

    // Normalize LinkedIn Collection URLs
    if (targetUrl.includes('linkedin.com/jobs/collections/') && targetUrl.includes('currentJobId=')) {
      const urlObj = new URL(targetUrl);
      const jobId = urlObj.searchParams.get('currentJobId');
      if (jobId) {
        targetUrl = `https://www.linkedin.com/jobs/view/${jobId}`;
      }
    }

    // ── Attempt 1: Normal Scrape ──
    const scraped = await scrapeJobFromUrl(targetUrl);

    if (scraped.success) {
      const jobDetails = await extractJobDetails(scraped.text, targetUrl);
      return NextResponse.json({ success: true, job: jobDetails, rawTitle: scraped.title });
    }

    // ── Attempt 2: Security Fallback — Search company careers site ──
    console.log('[Fetch-Job] Scrape failed, trying career page fallback for:', targetUrl);

    const fallback = await tryCareerPageFallback(targetUrl);
    if (fallback) {
      return NextResponse.json({
        success: true,
        job: fallback,
        securityFallback: true,
        warning: 'This site has bot protection. Showing basic details extracted from the careers page.'
      });
    }

    // ── Attempt 3: Return partial info if URL gives us company/role clues ──
    const partialInfo = extractInfoFromUrl(targetUrl);
    if (partialInfo) {
      return NextResponse.json({
        success: true,
        job: partialInfo,
        securityFallback: true,
        warning: 'Could not bypass this site\'s security. Showing basic info extracted from the URL. Please visit the link directly to view the full job posting.'
      });
    }

    return NextResponse.json({
      error: `This website has strong bot protection — we cannot extract job details automatically. Please paste the job description text manually using the "Manual Paste" tab.`,
      securityBlocked: true
    }, { status: 422 });

  } catch (err) {
    console.error('Fetch job error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Try to get basic job details by searching the company's career page via Jina
async function tryCareerPageFallback(jobUrl) {
  try {
    const urlObj = new URL(jobUrl);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    // Extract company name from domain (e.g. "microsoft" from "careers.microsoft.com")
    const companyFromDomain = hostname
      .replace(/^(careers?|jobs?|work|apply)\./i, '')
      .split('.')[0];

    // Try Jina on the company's main careers page
    const careerPageUrl = `https://${hostname}/careers` ;
    const jinaRes = await fetch(`https://r.jina.ai/${careerPageUrl}`, {
      headers: { 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(12000),
    });

    let text = '';
    if (jinaRes.ok) {
      text = await jinaRes.text();
    }

    // If careers page didn't work, try the raw Jina on the original URL (may get partial)
    if (!text || text.length < 200) {
      const rawRes = await fetch(`https://r.jina.ai/${jobUrl}`, {
        headers: { 'Accept': 'text/plain' },
        signal: AbortSignal.timeout(12000),
      });
      if (rawRes.ok) text = await rawRes.text();
    }

    if (!text || text.length < 100) return null;

    // Use AI to extract whatever we can from the partial text
    const system = `You are a job detail extractor. Given the following text from a company's careers page or job posting (which may be partial or security-blocked), extract what you can.

Return a JSON object with these fields (use null for anything not found, and extract key points into arrays):
{
  "title": "job title from URL or page",
  "company": "company name",
  "location": "location if found",
  "type": "employment type if found",
  "experience": "experience if found",
  "salary": "salary if found",
  "description": "full job description found",
  "applyLink": "${jobUrl}",
  "skills": ["extracted technical skills", "required tools", "programming languages"],
  "responsibilities": ["extracted key duties and responsibilities"],
  "requirements": ["extracted qualifications, education, and requirements"],
  "benefits": ["extracted perks, benefits, and compensation details"]
}

Only include data that actually exists in the text. Extract as much as possible for skills, responsibilities, requirements, and benefits from the description.`;

    const result = safeJSONParse(await invokeAI(system, `URL: ${jobUrl}\n\nPage content (partial):\n${text.substring(0, 5000)}`, 3000), null);

    if (result && (result.title || result.company)) {
      // Enrich company name from domain if missing
      if (!result.company) result.company = companyFromDomain;
      result.applyLink = jobUrl;
      return result;
    }

    return null;
  } catch (e) {
    console.warn('[CareerFallback] Failed:', e.message);
    return null;
  }
}

// Extract company/role hints purely from URL structure
function extractInfoFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const pathname = urlObj.pathname;

    // Get company from domain
    const domainParts = hostname.replace(/^(careers?|jobs?|work)\./i, '').split('.');
    const company = domainParts[0]
      .replace(/-/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Try to get role from pathname
    const pathSegments = pathname.split('/').filter(Boolean);
    let title = null;
    for (const seg of pathSegments.reverse()) {
      const cleaned = seg.replace(/[-_]/g, ' ').replace(/[^a-zA-Z0-9 ]/g, '').trim();
      if (cleaned.length > 4 && !/^\d+$/.test(cleaned)) {
        title = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    if (!company && !title) return null;

    return {
      title: title || 'Job Opening',
      company,
      location: null,
      type: null,
      experience: null,
      salary: null,
      description: `This job posting is on ${company}'s careers site. Click "Apply Now" to view the full details directly.`,
      applyLink: url,
      skills: [],
      responsibilities: [],
      requirements: [],
      benefits: [],
    };
  } catch (e) {
    return null;
  }
}
