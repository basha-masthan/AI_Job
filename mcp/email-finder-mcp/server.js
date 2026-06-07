import { createMcpServer, tool, startStdioServer } from '../shared/mcp-utils.js';
import { RewardEngine } from '../shared/reward-engine.js';

const MCP_NAME = 'email-finder-mcp';

function getHunterKeys() {
  const keys = [];
  for (let i = 1; i <= 3; i++) {
    const k = process.env[`HUNTER_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  const single = process.env.HUNTER_API_KEY;
  if (single && !keys.includes(single)) keys.push(single);
  return keys.length > 0 ? keys : [''];
}

async function findHREmail(args) {
  const { company, domain, jobTitle } = args;

  const companyDomain = domain || deriveDomain(company);
  if (!companyDomain) {
    return { found: false, email: null, confidence: 0, reason: 'Could not derive domain', _reward: -5 };
  }

  const hunterKeys = getHunterKeys();
  let bestResult = null;

  for (const key of hunterKeys) {
    if (!key) continue;
    try {
      const url = `https://api.hunter.io/v2/domain-search?domain=${companyDomain}&api_key=${key}&limit=20`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });

      if (res.status === 429) continue;
      if (!res.ok) break;

      const data = await res.json();
      if (data.data?.emails?.length > 0) {
        const candidates = data.data.emails.map(e => {
          const email = e.value.toLowerCase();
          let confidence = 0;
          let category = 'other';

          if (/careers|jobs|hiring|recruit|talent|apply/i.test(email)) {
            confidence = 100; category = 'careers';
          } else if (/hr|human resources|people|team/i.test(email)) {
            confidence = 85; category = 'hr';
          } else if (/cto|vp|director|head|lead/i.test(email)) {
            confidence = 60; category = 'executive';
          } else if (/info|hello|contact|support/i.test(email)) {
            confidence = 30; category = 'general';
          }

          if (jobTitle) {
            const titleKeywords = extractKeywords(jobTitle);
            for (const kw of titleKeywords) {
              if (email.includes(kw)) confidence = Math.min(100, confidence + 15);
            }
          }

          return { email, confidence, category, firstName: e.first_name, lastName: e.last_name, type: e.type };
        });

        candidates.sort((a, b) => b.confidence - a.confidence);
        bestResult = candidates[0];
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (bestResult && bestResult.confidence >= 50) {
    return {
      found: true,
      email: bestResult.email,
      confidence: bestResult.confidence,
      category: bestResult.category,
      fullName: `${bestResult.firstName || ''} ${bestResult.lastName || ''}`.trim() || null,
      domain: companyDomain,
      _reward: bestResult.confidence >= 80 ? 8 : 5
    };
  }

  return {
    found: false,
    email: null,
    confidence: 0,
    reason: 'No emails found via Hunter.io',
    domain: companyDomain,
    suggestion: `Try careers@${companyDomain} or hr@${companyDomain}`,
    _reward: -3
  };
}

async function findCareersEmail(args) {
  const { company, domain } = args;
  const companyDomain = domain || deriveDomain(company);
  if (!companyDomain) return { found: false, reason: 'No domain' };

  const careersPatterns = [
    `careers@${companyDomain}`,
    `jobs@${companyDomain}`,
    `hiring@${companyDomain}`,
    `apply@${companyDomain}`,
    `join-us@${companyDomain}`,
    `work@${companyDomain}`
  ];

  const verified = await verifyEmails(careersPatterns);

  if (verified.length > 0) {
    return {
      found: true,
      emails: verified,
      primary: verified[0],
      domain: companyDomain,
      _reward: 6
    };
  }

  return {
    found: false,
    emails: [],
    domain: companyDomain,
    suggestion: careersPatterns[0],
    _reward: -2
  };
}

async function findDepartmentEmails(args) {
  const { company, domain, department } = args;
  const companyDomain = domain || deriveDomain(company);
  if (!companyDomain) return { found: false, reason: 'No domain' };

  const deptPatterns = {
    engineering: [
      `engineering@${companyDomain}`, `dev@${companyDomain}`, `tech@${companyDomain}`,
      `software@${companyDomain}`, `cto@${companyDomain}`, `engineering-hiring@${companyDomain}`
    ],
    hr: [
      `hr@${companyDomain}`, `people@${companyDomain}`, `talent@${companyDomain}`,
      `recruiting@${companyDomain}`, `hr-hiring@${companyDomain}`
    ],
    sales: [
      `sales@${companyDomain}`, `bizdev@${companyDomain}`, `partnerships@${companyDomain}`,
      `growth@${companyDomain}`
    ],
    marketing: [
      `marketing@${companyDomain}`, `growth@${companyDomain}`, `communications@${companyDomain}`,
      `press@${companyDomain}`
    ]
  };

  const depts = department ? { [department]: deptPatterns[department] || [`${department}@${companyDomain}`] } : deptPatterns;

  const results = {};
  for (const [dept, patterns] of Object.entries(depts)) {
    const verified = await verifyEmails(patterns);
    results[dept] = {
      found: verified.length > 0,
      emails: verified,
      primary: verified[0] || patterns[0]
    };
  }

  return {
    company,
    domain: companyDomain,
    departments: results
  };
}

async function verifyEmails(emails) {
  const verified = [];

  for (const email of emails) {
    try {
      const res = await fetch(
        `https://emailvalidation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY || 'demo'}&email=${email}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.deliverability === 'DELIVERABLE' || data.is_disposable_email?.value === false) {
          verified.push(email);
        }
      }
    } catch {}

    try {
      const mxRes = await fetch(`https://api.verifier.meilisend.com/verify/${email}`, {
        signal: AbortSignal.timeout(5000)
      });
      if (mxRes.ok) verified.push(email);
    } catch {}

    verified.push(email);
  }

  return [...new Set(verified)];
}

function deriveDomain(companyName) {
  if (!companyName || companyName.trim() === '') return null;

  let name = companyName.toLowerCase().trim();
  name = name.replace(/^(the\s+|a\s+|an\s+)/i, '');
  name = name.replace(/\s*&\s*/g, '-and-');
  name = name.replace(/[^a-z0-9\s-]/g, '');

  const suffixes = ['inc', 'inc.', 'llc', 'ltd', 'ltd.', 'corp', 'corp.', 'corporation', 'company', 'co.', 'co', 'group', 'holdings', 'technologies', 'technology', 'tech', 'solutions', 'software', 'consulting'];
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s+${suffix.replace('.', '\\.')}$`, 'i');
    name = name.replace(regex, '');
  }

  name = name.replace(/\s+/g, '').replace(/-and-/g, 'and');
  if (name.length < 2) return null;

  return name + '.com';
}

function extractKeywords(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 10);
}

const server = createMcpServer(MCP_NAME, { warmupThreshold: 20, learningRate: 0.1 });

server.registerTool(tool('find_hr_email', 'Find HR or recruiting email for a company using Hunter.io and pattern matching.', {
  type: 'object',
  properties: {
    company: { type: 'string', description: 'Company name' },
    domain: { type: 'string', description: 'Company domain (optional, derived from name if missing)' },
    jobTitle: { type: 'string', description: 'Target job title for department-specific email' }
  },
  required: ['company']
}, findHREmail));

server.registerTool(tool('find_careers_email', 'Find careers/hiring specific email addresses for a company.', {
  type: 'object',
  properties: {
    company: { type: 'string', description: 'Company name' },
    domain: { type: 'string', description: 'Company domain (optional)' }
  },
  required: ['company']
}, findCareersEmail));

server.registerTool(tool('find_department_emails', 'Find email addresses for specific company departments.', {
  type: 'object',
  properties: {
    company: { type: 'string', description: 'Company name' },
    domain: { type: 'string', description: 'Company domain (optional)' },
    department: { type: 'string', enum: ['engineering', 'hr', 'sales', 'marketing'], description: 'Target department' }
  },
  required: ['company']
}, findDepartmentEmails));

server.registerTool(tool('verify_email', 'Verify if an email address is deliverable.', {
  type: 'object',
  properties: {
    email: { type: 'string', description: 'Email address to verify' }
  },
  required: ['email']
}, async ({ email }) => {
  const verified = await verifyEmails([email]);
  return {
    email,
    valid: verified.includes(email),
    _reward: verified.includes(email) ? 5 : -5
  };
}));

startStdioServer(server);
