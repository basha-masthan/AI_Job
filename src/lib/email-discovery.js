import fs from 'fs';
import path from 'path';
import dns from 'dns';
import net from 'net';

const BLOCKLIST = /^(support|info|contact|sales|help|hello|noreply|no-reply|corrections|press|media|admin|webmaster|billing|abuse|marketing|feedback|enquiries|enquiry|questions|support-cases|cts-support|service)@/i;

function addLogConsole(step, message, status) {
  console.log(`[EMAIL-DISCOVERY] [${status}] ${step}: ${message}`);
}

function getCoresignalKey() {
  return process.env.CORESIGNAL_API_KEY || 'f9PsqgV7xBBB0zkrR1oDuNCn2BSUORuZ';
}

// ── Email Source Keys ────────────────────────────────────────────
function getSnovKeys() {
  return [
    process.env.SNOV_API_KEY_1,
    process.env.SNOV_API_KEY_2,
  ].filter(Boolean);
}

function getAnyMailKeys() {
  return [
    process.env.ANYMAIL_API_KEY_1,
    process.env.ANYMAIL_API_KEY_2,
  ].filter(Boolean);
}

function getProxycurlKey() {
  return process.env.PROXYCURL_API_KEY || '';
}

function getSerperKey() {
  return process.env.SERPER_API_KEY || 'dda58ce4c8a6238a447510f8536ad4581f200731';
}

function getHunterKeys() {
  return [process.env.HUNTER_API_KEY].filter(Boolean);
}

// ── SOURCE 1: Hunter.io (Primary) ───────────────────────────
async function tryHunter(domain) {
  const keys = getHunterKeys();
  for (const key of keys) {
    if (!key) continue;
    try {
      const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${key}&limit=20`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.status === 429) continue;
      if (!res.ok) break;
      const data = await res.json();
      if (data.data?.emails?.length > 0) {
        const hrPriority = ['hr', 'hiring', 'careers', 'jobs', 'recruit', 'talent', 'people'];
        const hrEmail = data.data.emails.find(e => hrPriority.some(k => (e.value || '').toLowerCase().includes(k)));
        if (hrEmail) return hrEmail.value;
        return data.data.emails[0].value;
      }
    } catch { continue; }
  }
  return null;
}

function deriveDomain(companyName) {
  let name = companyName.toLowerCase().trim();
  name = name.replace(/\s+(inc|llc|ltd|pvt|private|limited|corp|technologies|tech|solutions|software|systems|services|group|global|international)\.?$/i, '');
  // Preserve dots for domain-like names, strip everything else
  if (/[a-z0-9]\.[a-z]{2,}/.test(name)) {
    // Looks like it already has a domain pattern
    name = name.replace(/[^a-z0-9.]/g, '');
  } else {
    name = name.replace(/[^a-z0-9]/g, '');
  }
  if (name.length < 2) return null;
  return name.includes('.') ? name : `${name}.com`;
}

export function extractCompanyDomain(companyName) {
  if (!companyName || companyName.trim() === '') return null;
  const name = companyName.trim();
  const commonPlatforms = [
    'wellfound', 'linkedin', 'indeed', 'glassdoor', 'dice', 'monster',
    'ziprecruiter', 'simplyhired', 'careerbuilder', 'naukri', 'internshala',
    'cutshort', 'hirist', 'iimjobs', 'foundit', 'apna',
    'remoteok', 'weworkremotely', 'remotive', 'angel', 'ycombinator',
    'hackernews', 'news.ycombinator', 'jobs.lever', 'jobs.greenhouse',
    'boards.greenhouse', 'apply.workable', 'lever.co', 'greenhouse.io',
    'ashbyhq', 'bamboohr', 'workday', 'taleo', 'smartrecruiters',
  ];
  const lowerName = name.toLowerCase();
  for (const platform of commonPlatforms) {
    if (lowerName.includes(platform)) return null;
  }
  if (lowerName.includes('via ') || lowerName.includes('posted by') || lowerName.includes(' on ')) {
    const parts = lowerName.split(/(?:via|posted by|on)\s+/i);
    if (parts.length > 0) {
      const actualCompany = parts[0].trim();
      if (actualCompany && actualCompany.length > 2) return deriveDomain(actualCompany);
    }
  }
  return deriveDomain(name);
}

// ── SOURCE 1: Coresignal (LinkedIn data enrichment) ─────────────
async function tryCoreSigal(companyName) {
  const key = getCoresignalKey();
  if (!key) return null;
  try {
    const searchRes = await fetch('https://api.coresignal.com/cdapi/v1/linkedin/company/search/filter', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: companyName }),
      signal: AbortSignal.timeout(8000),
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const companyIds = Array.isArray(searchData) ? searchData : (searchData.data || []);
    if (companyIds.length === 0) return null;

    const collectRes = await fetch(`https://api.coresignal.com/cdapi/v1/linkedin/company/collect/${companyIds[0]}`, {
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!collectRes.ok) return null;
    const collectData = await collectRes.json();
    const emailMatches = JSON.stringify(collectData).match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
    const uniqueEmails = [...new Set(emailMatches)].filter(e =>
      !e.includes('linkedin') && !e.includes('example') && !e.includes('sentry') && !e.includes('w3.org')
    );
    const hrPriority = ['hr', 'hiring', 'careers', 'jobs', 'recruit', 'talent', 'people'];
    return uniqueEmails.find(e => hrPriority.some(k => e.toLowerCase().includes(k))) || uniqueEmails[0] || null;
  } catch {
    return null;
  }
}

// ── SOURCE 2: Snov.io (free tier: 50/mo) ────────────────────────
async function trySnovioDomain(domain) {
  const keys = getSnovKeys();
  for (const key of keys) {
    try {
      const [clientId, clientSecret] = key.split(':');
      if (!clientId || !clientSecret) continue;

      // Get OAuth access token from Snov.io
      const tokenRes = await fetch('https://api.snov.io/v1/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
        signal: AbortSignal.timeout(6000),
      });
      if (!tokenRes.ok) continue;
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) continue;

      // Search emails by domain
      const searchRes = await fetch('https://api.snov.io/v2/domain-emails-with-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, domain, type: 'all', limit: 10 }),
        signal: AbortSignal.timeout(8000),
      });
      if (!searchRes.ok) continue;
      const data = await searchRes.json();
      const emails = data.emails || [];
      if (emails.length === 0) continue;
      const hrPriority = ['hr', 'hiring', 'careers', 'jobs', 'recruit', 'talent', 'people'];
      return emails.find(e => hrPriority.some(k => (e.email || '').toLowerCase().includes(k)))?.email
        || emails[0]?.email
        || null;
    } catch (e) {
      console.warn(`[SNOV.IO] Error: ${e.message}`);
      continue;
    }
  }
  return null;
}

// ── SOURCE 3: AnyMailFinder ──────────────────────────────────────
async function tryAnyMailFinder(domain) {
  const keys = getAnyMailKeys();
  for (const key of keys) {
    try {
      const res = await fetch(`https://api.anymailfinder.com/v5.0/search/company.json?company_domain=${domain}`, {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      return data.email || null;
    } catch { continue; }
  }
  return null;
}

// ── SOURCE 4: ProxyCurl People Search ───────────────────────────
async function tryProxyCurl(companyName, domain) {
  const key = getProxycurlKey();
  if (!key) return null;
  try {
    const url = `https://nubela.co/proxycurl/api/linkedin/company/employees/?company_name=${encodeURIComponent(companyName)}&role_search=hr+recruiter+talent&page_size=3&enrich_profiles=enrich`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    for (const emp of (data.employees || [])) {
      if (emp.profile?.personal_emails?.length > 0) return emp.profile.personal_emails[0];
      if (emp.profile?.work_email) return emp.profile.work_email;
    }
    return null;
  } catch {
    return null;
  }
}

// ── SOURCE 5: Serper.dev — Search for email in Google ───────────
async function trySerperEmailSearch(companyName, domain) {
  const key = getSerperKey();
  if (!key) return null;
  try {
    const queries = [
      `"${companyName}" hiring OR HR email "@${domain}"`,
      `site:${domain} email contact HR`,
      `"@${domain}" careers OR jobs`,
    ];

    for (const q of queries) {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, num: 5 }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const allText = [
        ...(data.organic || []).map(r => `${r.title} ${r.snippet}`),
        ...(data.knowledgeGraph ? [JSON.stringify(data.knowledgeGraph)] : []),
      ].join(' ');

      const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      const found = allText.match(emailRegex) || [];
      const validEmails = found.filter(e =>
        e.includes('@') &&
        !e.includes('example') &&
        !e.includes('sentry') &&
        !e.includes('w3.org') &&
        (e.includes(domain) || /careers|hr|jobs|hiring|recruit|talent|people/i.test(e))
      );

      if (validEmails.length > 0) {
        const hrPriority = ['hr', 'hiring', 'careers', 'jobs', 'recruit', 'talent', 'people'];
        return validEmails.find(e => hrPriority.some(k => e.toLowerCase().includes(k))) || validEmails[0];
      }
    }
  } catch { }
  return null;
}

// ── Last resort: Try Serper for domain-related search ────────────
async function trySerperFallback(companyName, domain) {
  try {
    const key = process.env.SERPER_API_KEY || 'dda58ce4c8a6238a447510f8536ad4581f200731';
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `site:${domain} contact email`, num: 5 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    for (const r of data.organic || []) {
      const m = (r.snippet || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (m) return m[0];
    }
  } catch {}
  return null;
}

function isCommonJobBoard(hostname) {
  const lower = hostname.toLowerCase();
  const commonPlatforms = [
    'wellfound', 'linkedin', 'indeed', 'glassdoor', 'dice', 'monster',
    'ziprecruiter', 'simplyhired', 'careerbuilder', 'naukri', 'internshala',
    'cutshort', 'hirist', 'iimjobs', 'foundit', 'apna',
    'remoteok', 'weworkremotely', 'remotive', 'angel', 'ycombinator',
    'hackernews', 'news.ycombinator', 'jobs.lever', 'jobs.greenhouse',
    'boards.greenhouse', 'apply.workable', 'lever.co', 'greenhouse.io',
    'ashbyhq', 'bamboohr', 'workday', 'taleo', 'smartrecruiters', 'arbeitnow', 'adzuna'
  ];
  return commonPlatforms.some(platform => lower.includes(platform));
}

async function findCompanyDomain(companyName) {
  const key = getSerperKey();
  if (!key || !companyName) return null;
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: companyName, num: 3 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const firstResult = data.organic?.[0]?.link;
    if (firstResult) {
      const urlObj = new URL(firstResult);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      if (!isCommonJobBoard(hostname)) {
        return hostname;
      }
    }
  } catch {}
  return null;
}

// ── MAIN ENTRY ───────────────────────────────────────────────────
export async function findCompanyEmail(companyName, jobUrl = '', addLog = addLogConsole) {
  let companyDomain = null;

  // 1. If job URL is direct, extract domain from it
  if (jobUrl) {
    try {
      const urlObj = new URL(jobUrl);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      if (!isCommonJobBoard(hostname)) {
        companyDomain = hostname;
        console.log(`[EMAIL DISCOVERY] Extracted domain from Job URL: ${companyDomain}`);
      }
    } catch {}
  }

  // 2. If not found, try to search for the official company website via Serper
  if (!companyDomain) {
    companyDomain = await findCompanyDomain(companyName);
    if (companyDomain) {
      console.log(`[EMAIL DISCOVERY] Discovered domain via Serper: ${companyDomain}`);
    }
  }

  // 3. Fallback to derived domain
  if (!companyDomain) {
    companyDomain = extractCompanyDomain(companyName);
    if (companyDomain) {
      console.log(`[EMAIL DISCOVERY] Derived domain from company name: ${companyDomain}`);
    }
  }

  if (!companyDomain) {
    addLog('No Domain', `Could not derive domain for "${companyName}". Skipping.`, 'error');
    return null;
  }

  addLog('Email Discovery', `Searching emails for ${companyName} (${companyDomain})...`, 'info');
  console.log(`\n[EMAIL DISCOVERY] Company: ${companyName} | Domain: ${companyDomain}`);

  // Sequential fallback: Hunter → Snov → Coresignal → Serper
  const TIMEOUT = 10000;
  const withTimeout = (promise, ms) =>
    Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))]);

  const [hunterEmail, snovEmail, coresignalEmail, serperEmail] = await Promise.all([
    withTimeout(tryHunter(companyDomain), TIMEOUT),
    withTimeout(trySnovioDomain(companyDomain), TIMEOUT),
    withTimeout(tryCoreSigal(companyName), TIMEOUT),
    withTimeout(trySerperEmailSearch(companyName, companyDomain), TIMEOUT),
  ]);

  const candidates = [
    { email: hunterEmail, source: 'Hunter.io', score: 100 },
    { email: snovEmail, source: 'Snov.io', score: 80 },
    { email: coresignalEmail, source: 'Coresignal', score: 70 },
    { email: serperEmail, source: 'Serper Search', score: 60 },
  ].filter(c => c.email && c.email.includes('@') && c.email.split('@')[1].includes('.'));

  const validEmails = [];
  const seenEmails = new Set();

  for (const c of candidates) {
    if (!seenEmails.has(c.email) && !BLOCKLIST.test(c.email)) {
      seenEmails.add(c.email);
      const verification = await verifyEmailFast(c.email);
      if (verification.valid) {
        validEmails.push(c.email);
      }
    }
  }

  if (validEmails.length === 0) {
    const serperFallback = await trySerperFallback(companyName, companyDomain);
    if (serperFallback && serperFallback.includes('@') && !BLOCKLIST.test(serperFallback)) {
      const verification = await verifyEmailFast(serperFallback);
      if (verification.valid) {
        addLog('Serper ✓', `Found email via domain search: ${serperFallback}`, 'success');
        validEmails.push(serperFallback);
      }
    }
  }

  if (validEmails.length > 0) {
    addLog(`Emails Found`, `Found ${validEmails.length} email(s) for ${companyName}`, 'success');
    console.log(`[EMAIL DISCOVERY] ✅ Found: ${validEmails.join(', ')}`);
    return validEmails;
  }

  addLog('No Email Found', `Could not find any contact email for ${companyName}`, 'error');
  return [];
}

export async function verifyEmailFast(email) {
  if (!email || !email.includes('@')) return { valid: false };
  if (BLOCKLIST.test(email)) return { valid: false };

  const [, domain] = email.split('@');
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        return resolve({ valid: false });
      }

      addresses.sort((a, b) => a.priority - b.priority);
      const mx = addresses[0].exchange;
      
      const socket = net.createConnection(25, mx);
      socket.setTimeout(3000);
      
      let step = 0;
      
      socket.on('data', (data) => {
        const msg = data.toString();
        if (msg.startsWith('220') && step === 0) {
          step = 1;
          socket.write(`HELO ${domain}\r\n`);
        } else if (msg.startsWith('250') && step === 1) {
          step = 2;
          socket.write(`MAIL FROM:<check@${domain}>\r\n`);
        } else if (msg.startsWith('250') && step === 2) {
          step = 3;
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (msg.startsWith('250') && step === 3) {
          socket.end();
          resolve({ valid: true });
        } else if (msg.match(/^[45]/)) {
          socket.end();
          resolve({ valid: false });
        }
      });
      
      socket.on('error', () => {
        // If connection fails, assume valid to avoid false positives blocking good emails
        resolve({ valid: true }); 
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ valid: true }); // Timeout: assume valid so we don't drop good emails
      });
    });
  });
}
