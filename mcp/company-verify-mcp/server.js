import { createMcpServer, tool, startStdioServer } from '../shared/mcp-utils.js';
import { RewardEngine, calculateDefaultReward } from '../shared/reward-engine.js';

const MCP_NAME = 'company-verify-mcp';

const VERIFIED_CACHE_FILE = new URL('../company-verify-mcp/data/verified_cache.json', import.meta.url).pathname.replace(/\\/g, '/');
const DATA_DIR = new URL('../company-verify-mcp/data', import.meta.url).pathname.replace(/\\/g, '/');

import fs from 'fs';
const path = new URL('data/verified_cache.json', `file://${DATA_DIR}/`).pathname.replace(/\\/g, '/');

function getCacheFile() {
  try {
    const dir = DATA_DIR;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path;
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({ companies: {}, domains: {}, updatedAt: new Date().toISOString() }));
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return { companies: {}, domains: {}, updatedAt: new Date().toISOString() };
  }
}

function saveCache(cache) {
  try {
    fs.writeFileSync(path, JSON.stringify(cache, null, 2));
  } catch {}
}

const SCAM_PATTERNS = [
  'get-paid-to', 'work-from-home-scam', 'easy-money', 'no-experience-needed-high-pay',
  'data-entry-jobs-xyz', 'clickworker', 'mturk-fake', 'guru99-scam'
];

const KNOWN_RED_FLAGS = [
  { pattern: /gateway\.herokuapp/i, reason: 'Suspicious hosting pattern' },
  { pattern: /careers[\._-]?builder/i, reason: 'Possible fake job board' },
  { pattern: /^https?:\/\/[a-z]{5}\.[a-z]{10,}/i, reason: 'Random subdomain pattern' },
  { pattern: /free-\w+\.com/i, reason: 'Free domain often used in scams' }
];

const KNOWN_GOOD_SIGNS = [
  'linkedin company page',
  'crunchbase profile',
  'glassdoor reviews',
  'owler company profile',
  'builtin city partner',
  'glassdoor.com/companies',
  'wellfound.com/companies',
  'careers page',
  'about-us page',
  'team page'
];

async function verifyCompany(args) {
  const { name, domain, url } = args;

  const domainResult = domain ? await verifyDomain(domain) : null;
  const webResult = url ? await verifyWebPresence(url || `https://${domain}`) : null;
  const socialResult = await checkSocialProof(name, domain);

  let overallScore = 0;
  let checks = [];

  if (domainResult) {
    overallScore += domainResult.score * 0.4;
    checks.push(domainResult);
  } else {
    checks.push({ check: 'domain', score: 0, status: 'unknown', reason: 'No domain provided' });
  }

  if (webResult) {
    overallScore += webResult.score * 0.35;
    checks.push(webResult);
  } else {
    checks.push({ check: 'web_presence', score: 0, status: 'unknown', reason: 'Web presence check unavailable' });
  }

  if (socialResult) {
    overallScore += socialResult.score * 0.25;
    checks.push(socialResult);
  } else {
    checks.push({ check: 'social_proof', score: 0, status: 'unknown', reason: 'Social proof check unavailable' });
  }

  const isLegit = overallScore >= 60;
  const isSuspicious = overallScore < 30;

  const result = {
    company: name,
    domain,
    verified: isLegit,
    suspicious: isSuspicious,
    overallScore: parseFloat(overallScore.toFixed(1)),
    checks,
    recommendation: isLegit ? 'verified' : isSuspicious ? 'avoid' : 'review_manually',
    cached: false
  };

  const cache = getCacheFile();
  const key = name.toLowerCase().trim();
  if (cache.companies[key]) {
    result.cached = true;
    result.cacheAge = new Date() - new Date(cache.companies[key].verifiedAt);
  }

  cache.companies[key] = {
    ...result,
    verifiedAt: new Date().toISOString()
  };
  saveCache(cache);

  result._reward = isLegit && !isSuspicious ? 5 : isSuspicious ? -8 : 0;

  return result;
}

async function verifyDomain(domain) {
  const cache = getCacheFile();
  const d = domain.toLowerCase().trim();

  if (cache.domains[d]) {
    const cached = cache.domains[d];
    if (new Date() - new Date(cached.checkedAt) < 7 * 24 * 60 * 60 * 1000) {
      return { ...cached, fromCache: true };
    }
  }

  let score = 0;
  const reasons = [];

  const tlds = ['.com', '.io', '.co', '.ai', '.org', '.net'];
  const isGoodTld = tlds.some(t => d.endsWith(t));
  if (isGoodTld) {
    score += 20;
    reasons.push('Professional TLD');
  } else {
    score -= 10;
    reasons.push('Non-standard TLD');
  }

  const cleanDomain = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  try {
    const res = await fetch(`https://${cleanDomain}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok || res.status === 301 || res.status === 302) {
      score += 40;
      reasons.push('Domain resolves');
    } else if (res.status === 404 || res.status === 403) {
      score += 15;
      reasons.push('Domain exists (returns ' + res.status + ')');
    } else {
      score += 5;
      reasons.push('Domain reachable but blocked');
    }
  } catch {
    score -= 20;
    reasons.push('Domain does not resolve');
  }

  for (const flag of KNOWN_RED_FLAGS) {
    if (d.includes(flag)) {
      score -= 30;
      reasons.push(`Contains scam pattern: ${flag}`);
    }
  }

  for (const rf of KNOWN_RED_FLAGS) {
    if (rf.pattern && rf.pattern.test(d)) {
      score -= 25;
      reasons.push(rf.reason);
    }
  }

  const result = {
    check: 'domain',
    domain: d,
    score: Math.max(0, Math.min(100, score)),
    status: score >= 50 ? 'pass' : score >= 20 ? 'warning' : 'fail',
    reasons,
    checkedAt: new Date().toISOString()
  };

  cache.domains[d] = result;
  saveCache(cache);

  return result;
}

async function verifyWebPresence(url) {
  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobBot/1.0)' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok && res.status !== 301 && res.status !== 302) {
      return {
        check: 'web_presence',
        score: res.status === 404 ? 5 : 10,
        status: 'warning',
        reasons: [`HTTP ${res.status}`],
        checkedAt: new Date().toISOString()
      };
    }

    const html = await res.text().catch(() => '');
    const text = html.replace(/<[^>]+>/g, ' ').substring(0, 5000).toLowerCase();

    let score = 40;
    const reasons = [];

    for (const sign of KNOWN_GOOD_SIGNS) {
      if (text.includes(sign)) {
        score += 5;
      }
    }

    if (text.includes('careers') || text.includes('jobs') || text.includes('hiring')) {
      score += 10;
      reasons.push('Has careers/jobs page');
    }

    if (text.includes('about') || text.includes('contact') || text.includes('team')) {
      score += 10;
      reasons.push('Has professional pages');
    }

    if (text.includes('privacy') || text.includes('terms')) {
      score += 5;
      reasons.push('Has legal pages');
    }

    if (html.length < 500) {
      score -= 20;
      reasons.push('Minimal content (possible placeholder)');
    }

    return {
      check: 'web_presence',
      score: Math.max(0, Math.min(100, score)),
      status: score >= 60 ? 'pass' : score >= 30 ? 'warning' : 'fail',
      reasons,
      checkedAt: new Date().toISOString()
    };
  } catch (e) {
    return {
      check: 'web_presence',
      score: 10,
      status: 'fail',
      reasons: [e.message],
      checkedAt: new Date().toISOString()
    };
  }
}

async function checkSocialProof(companyName, domain) {
  if (!companyName) return { check: 'social_proof', score: 0, status: 'unknown', reasons: ['No company name'], checkedAt: new Date().toISOString() };

  let score = 30;
  const reasons = [];
  const name = companyName.replace(/[^a-zA-Z0-9\s]/g, '').trim();

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(name + ' ' + (domain || ''))}&num=5`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) throw new Error(`Search returned ${res.status}`);

    const text = (await res.text()).substring(0, 10000).toLowerCase();

    const socialSignals = [
      { term: 'linkedin', weight: 15 },
      { term: 'crunchbase', weight: 15 },
      { term: 'glassdoor', weight: 10 },
      { term: 'owler', weight: 10 },
      { term: 'indeed company', weight: 8 },
      { term: 'team members', weight: 5 },
      { term: 'founded', weight: 5 },
      { term: 'employees', weight: 5 },
      { term: 'funding', weight: 10 }
    ];

    for (const s of socialSignals) {
      if (text.includes(s.term)) {
        score += s.weight;
        reasons.push(`Found: ${s.term}`);
      }
    }

    if (text.includes('linkedin.com/company/')) score += 10;

  } catch (e) {
    score -= 10;
    reasons.push('Social proof check limited');
  }

  return {
    check: 'social_proof',
    score: Math.max(0, Math.min(100, score)),
    status: score >= 50 ? 'pass' : score >= 25 ? 'warning' : 'fail',
    reasons,
    checkedAt: new Date().toISOString()
  };
}

async function checkLegitimacy(args) {
  const { company, domain, url } = args;

  const v = await verifyCompany({ name: company, domain, url });
  const redFlags = [];

  if (v.overallScore < 30) {
    redFlags.push('Low overall score — possible fake company');
  }

  const domainCheck = v.checks?.find(c => c.check === 'domain');
  if (domainCheck?.status === 'fail') {
    redFlags.push('Domain verification failed');
  }

  const webCheck = v.checks?.find(c => c.check === 'web_presence');
  if (webCheck?.status === 'fail') {
    redFlags.push('No accessible web presence');
  }

  return {
    company,
    domain,
    legitimate: v.verified,
    score: v.overallScore,
    redFlags,
    recommendation: v.recommendation,
    _reward: v.verified && redFlags.length === 0 ? 8 : redFlags.length > 2 ? -10 : -2
  };
}

async function getCompanyInfo(args) {
  const { domain, companyName } = args;
  const info = {
    domain,
    name: companyName || domain?.split('.')[0],
    found: false,
    details: {}
  };

  if (!domain) return { ...info, error: 'No domain provided' };

  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    const homeRes = await fetch(`https://${cleanDomain}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobBot/1.0)' },
      signal: AbortSignal.timeout(8000)
    });

    if (homeRes.ok) {
      info.found = true;
      info.homepageAccessible = true;
    }
  } catch {
    info.homepageAccessible = false;
  }

  try {
    const searchRes = await fetch(
      `https://r.jina.ai/https://${cleanDomain}`,
      { headers: { 'X-With-Generated-Alt': 'true', 'Accept': 'text/plain' }, signal: AbortSignal.timeout(10000) }
    );
    if (searchRes.ok) {
      const text = await searchRes.text();
      info.details.snippet = text.substring(0, 500);
    }
  } catch {}

  const cache = getCacheFile();
  const cacheKey = (companyName || domain).toLowerCase().trim();
  if (cache.companies[cacheKey]) {
    info.cachedVerification = {
      score: cache.companies[cacheKey].overallScore,
      verified: cache.companies[cacheKey].verified,
      verifiedAt: cache.companies[cacheKey].verifiedAt
    };
  }

  return info;
}

const server = createMcpServer(MCP_NAME, { warmupThreshold: 15, learningRate: 0.1 });

server.registerTool(tool('verify_company', 'Verify a company\'s legitimacy. Checks domain, web presence, and social proof. Returns score 0-100 and recommendation.', {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Company name' },
    domain: { type: 'string', description: 'Company domain (e.g., "google.com")' },
    url: { type: 'string', description: 'Company URL (optional, overrides domain)' }
  },
  required: ['name']
}, verifyCompany));

server.registerTool(tool('check_legitimacy', 'Quick check if a company is legitimate or potentially a scam. Returns red flags and recommendation.', {
  type: 'object',
  properties: {
    company: { type: 'string', description: 'Company name' },
    domain: { type: 'string', description: 'Company domain' },
    url: { type: 'string', description: 'Company URL' }
  },
  required: ['company']
}, checkLegitimacy));

server.registerTool(tool('get_company_info', 'Get detailed information about a company from its domain.', {
  type: 'object',
  properties: {
    domain: { type: 'string', description: 'Company domain' },
    companyName: { type: 'string', description: 'Company name for context' }
  },
  required: ['domain']
}, getCompanyInfo));

startStdioServer(server);
