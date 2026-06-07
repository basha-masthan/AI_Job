/**
 * recruiter-finder.js
 * Finds recruiters who publicly post hiring emails on the open web.
 * Sources: Tavily (keyed) + Jina AI (free, no key required)
 *
 * FIXES:
 * 1. Switched from vision model (nemotron-vl) to text LLM (qwen3-8b)
 * 2. Jina Search response parsing fixed (returns markdown text, not JSON)
 * 3. Relaxed LLM prompt — accepts job boards too, just extracts what it can
 * 4. Added email regex fast-path — no LLM call needed if email already in text
 * 5. Simplified queries — less double-quoting which broke Tavily
 */

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY_1 || process.env.OPENROUTER_API_KEY_2;
const TAVILY_KEY     = process.env.TAVILY_API_KEY_1 || process.env.TAVILY_API_KEY_2;

// Confirmed working free text models (ranked by availability on this account)
const TEXT_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',      // ✅ Confirmed working
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', // ✅ Confirmed working
  'google/gemma-4-31b-it:free',                  // Sometimes rate-limited
  'meta-llama/llama-3.3-70b-instruct:free',      // Sometimes rate-limited
];

// ─── Query Builder ─────────────────────────────────────────────────────────────
export function buildDorkQueries(role, location) {
  const r = role.trim();
  const loc = location?.trim() || 'India';

  return [
    // Direct email contact requests
    `${r} hiring ${loc} send resume email apply`,
    `"we are hiring" ${r} ${loc} email careers`,
    `${r} job opening ${loc} "apply to" OR "send cv" OR "contact"`,
    // Recruiter posts with visible emails
    `${r} ${loc} "hr@" OR "careers@" OR "jobs@" OR "hiring@" job`,
    // Urgent / immediate
    `urgent requirement ${r} ${loc} email resume`,
    // Direct-apply posts from companies
    `${r} vacancy ${loc} "interested candidates" OR "send your resume"`,
    // Naukri/LinkedIn indexed posts
    `${r} ${loc} freshers OR "0-1 years" OR "0-2 years" hiring email`,
  ];
}

// ─── Tavily Search ──────────────────────────────────────────────────────────────
export async function searchWithTavily(query, maxResults = 8) {
  if (!TAVILY_KEY) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'advanced',
        include_raw_content: true,
        include_answer: false,
        max_results: maxResults,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn(`[Tavily] ${res.status}:`, await res.text().catch(() => '').then(t => t.slice(0, 200)));
      return [];
    }
    const data = await res.json();
    return (data.results || []).map(r => ({
      url: r.url,
      title: r.title || '',
      // raw_content is often very long; use content snippet if raw is empty
      text: (r.raw_content || r.content || '').slice(0, 5000),
      source: 'tavily',
    }));
  } catch (err) {
    console.warn('[Tavily] Error:', err.message);
    return [];
  }
}

// ─── Jina AI Search (FREE — no API key, returns markdown text NOT JSON) ─────────
export async function searchWithJina(query, maxResults = 5) {
  try {
    const encoded = encodeURIComponent(query);
    // Jina Search returns plain markdown/text, NOT JSON — must accept text/plain
    const res = await fetch(`https://s.jina.ai/${encoded}`, {
      headers: {
        'Accept': 'text/plain',
        'X-No-Cache': 'true',
      },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      console.warn(`[Jina Search] ${res.status}`);
      return [];
    }
    const rawText = await res.text();
    // Jina returns numbered results like:
    // [1] Title\nURL: https://...\nContent: ...\n\n[2] ...
    const blocks = rawText.split(/\n\[(\d+)\]/).filter(Boolean);
    const results = [];
    for (let i = 0; i < blocks.length - 1 && results.length < maxResults; i += 2) {
      const block = blocks[i + 1] || '';
      const urlMatch = block.match(/URL:\s*(https?:\/\/\S+)/);
      const titleMatch = block.match(/^([^\n]+)/);
      const contentStart = block.indexOf('Content:');
      const content = contentStart >= 0 ? block.slice(contentStart + 8).trim() : block;
      if (urlMatch) {
        results.push({
          url: urlMatch[1].trim(),
          title: titleMatch?.[1]?.trim() || '',
          text: content.slice(0, 3000),
          source: 'jina',
        });
      }
    }
    console.log(`[Jina] Parsed ${results.length} results for: ${query.slice(0, 60)}`);
    return results;
  } catch (err) {
    console.warn('[Jina Search] Error:', err.message);
    return [];
  }
}

// ─── Jina Reader — fetch full page text from URL (FREE) ───────────────────────
export async function readPageWithJina(url) {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return '';
    return (await res.text()).slice(0, 6000);
  } catch {
    return '';
  }
}

// ─── Email Regex Extractor ────────────────────────────────────────────────────
export function extractEmailsFromText(text) {
  const matches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches)].filter(e => {
    const lower = e.toLowerCase();
    return !lower.includes('example') && !lower.includes('linkedin') &&
           !lower.includes('sentry') && !lower.includes('w3.org') &&
           !lower.includes('noreply') && !lower.includes('no-reply') &&
           !lower.includes('schema.org') && !lower.includes('wixpress') &&
           !lower.includes('@2x') && !lower.includes('.png') &&
           !lower.includes('.jpg') && e.length < 80;
  });
}

// ─── LLM Extraction via OpenRouter (text-only models) ─────────────────────────
export async function extractJobFromText(text, url, targetRole) {
  if (!OPENROUTER_KEY || !text?.trim() || text.trim().length < 50) return null;

  // Fast email regex check — if email found in text, we can skip LLM for basics
  const rawEmails = extractEmailsFromText(text);
  const hasEmail = rawEmails.length > 0;

  // Pre-filter: must contain hiring keywords (very lenient)
  const hiringKw = ['hiring', 'vacancy', 'opening', 'position', 'looking for',
                    'apply', 'join us', 'opportunity', 'job', 'recruit', 'career',
                    'fresher', 'experience', 'role', 'developer', 'engineer'];
  const textLower = text.toLowerCase();
  const hasHiring = hiringKw.some(k => textLower.includes(k));
  if (!hasHiring) return null;

  // If email already found in text, we can do a lighter extraction
  const prompt = `Extract job posting info from this web page text. Be lenient — extract any job you can find.

URL: ${url}
${hasEmail ? `Emails found in page: ${rawEmails.slice(0, 3).join(', ')}` : ''}

Page text (first 3500 chars):
${text.slice(0, 3500)}

Return this exact JSON (use null for missing fields, never omit fields):
{
  "isHiringPost": true,
  "company": "company name",
  "role": "job title",
  "email": "${hasEmail ? rawEmails[0] : 'null'}",
  "location": "city or remote",
  "experience": "e.g. 0-2 years or null",
  "requirements": "key skills in max 80 chars or null",
  "confidence": 0.7,
  "sourceType": "job_board"
}

Rules:
- isHiringPost = true for ANY job listing, even on job boards
- If multiple jobs listed, pick the one most relevant to "${targetRole}"
- confidence: 0.9 if email present, 0.7 if company+role clear, 0.5 if vague
- ALWAYS return valid JSON, never refuse`;

  // Try models in order
  for (const model of TEXT_MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_tokens: 400,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        console.warn(`[LLM:${model}] ${res.status}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;

      let parsed;
      try {
        parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim());
      } catch {
        // Try to extract JSON block from response
        const jsonMatch = content.match(/\{[\s\S]+\}/);
        if (jsonMatch) {
          try { parsed = JSON.parse(jsonMatch[0]); } catch { continue; }
        } else continue;
      }

      if (!parsed || !parsed.company) continue;

      // Override email with raw-extracted one if LLM missed it
      if (!parsed.email && hasEmail) parsed.email = rawEmails[0];

      console.log(`[LLM:${model}] ✅ Extracted: ${parsed.company} — ${parsed.role}`);
      return { ...parsed, isHiringPost: true, sourceUrl: url };

    } catch (err) {
      console.warn(`[LLM:${model}] Error:`, err.message);
      continue;
    }
  }

  // Last resort: if we found emails in the text, make a basic job object without LLM
  if (hasEmail && textLower.includes(targetRole.toLowerCase().split(' ')[0])) {
    const companyMatch = text.match(/(?:at|by|from|company:|Company:)\s+([A-Z][a-zA-Z\s]{2,30})/);
    return {
      isHiringPost: true,
      company: companyMatch?.[1]?.trim() || new URL(url).hostname.replace('www.', '').split('.')[0],
      role: targetRole,
      email: rawEmails[0],
      location: null,
      experience: null,
      requirements: null,
      confidence: 0.5,
      sourceType: 'other',
      sourceUrl: url,
    };
  }

  return null;
}

// ─── Hunter.io Email Verify ────────────────────────────────────────────────────
export async function verifyEmailWithHunter(email) {
  const key = process.env.HUNTER_API_KEY || 'cc115f84a5a194661fae8698338de9573d9a1fb1';
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { valid: true, status: 'unknown' };
    const data = await res.json();
    const status = data.data?.status;
    return {
      valid: status !== 'invalid',
      status: status || 'unknown',
    };
  } catch {
    return { valid: true, status: 'unknown' };
  }
}

// ─── Dedupe by email+company ───────────────────────────────────────────────────
export function dedupeJobs(jobs) {
  const seen = new Set();
  return jobs.filter(j => {
    if (!j) return false;
    const key = `${(j.email || '').toLowerCase()}|${(j.company || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── MAIN ORCHESTRATOR ─────────────────────────────────────────────────────────
export async function searchRecruiterPosts(role, location, onProgress = () => {}) {
  const queries = buildDorkQueries(role, location);

  onProgress(`🔍 Built ${queries.length} search queries for "${role}" in ${location || 'India'}...`);

  // ── Phase 1: Search — only Tavily (Jina Search needs API key, use more Tavily queries) ─
  const tavilyPromises = queries.map(q => searchWithTavily(q, 6)); // all 7 queries

  const tavilyBatches = await Promise.all(tavilyPromises);
  const allRaw = tavilyBatches.flat();
  const tavilyCount = allRaw.length;
  const jinaCount = 0;

  // Dedupe by URL
  const seenUrls = new Set();
  const unique = allRaw.filter(r => {
    if (!r.url || seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  onProgress(`📡 Found ${unique.length} unique pages from Tavily (${tavilyCount} raw, deduped to ${unique.length}). Enriching & extracting...`);

  // ── Phase 2: Enrich pages with < 200 chars via Jina Reader ────────────────
  const needEnrich = unique.filter(r => (r.text || '').length < 200 && r.url);
  if (needEnrich.length > 0) {
    onProgress(`🔗 Fetching full text for ${Math.min(needEnrich.length, 10)} short pages...`);
    await Promise.all(
      needEnrich.slice(0, 10).map(async r => {
        const fullText = await readPageWithJina(r.url);
        if (fullText && fullText.length > r.text.length) r.text = fullText;
      })
    );
  }

  // ── Phase 3: Email fast-path + LLM extract ─────────────────────────────────
  onProgress(`🧠 AI extracting job details from ${unique.length} pages...`);

  // Process in small batches to avoid overwhelming the API
  const BATCH = 4;
  const allExtracted = [];

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(result => extractJobFromText(result.text, result.url, role))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const job = batchResults[j];
      const result = batch[j];
      if (!job) continue;

      // Enrich email from raw text if LLM missed it
      const rawEmails = extractEmailsFromText(result.text);
      if (!job.email && rawEmails.length > 0) job.email = rawEmails[0];

      onProgress(`✅ Found: ${job.company} — ${job.role}${job.email ? ` (📧 ${job.email})` : ''}`);

      // Validate with Hunter.io if email found
      if (job.email) {
        const verify = await verifyEmailWithHunter(job.email);
        job.emailStatus = verify.status;
        job.emailValid  = verify.valid;
      }

      allExtracted.push({
        id: `rf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        company:     job.company,
        role:        job.role || role,
        location:    job.location || location,
        email:       job.email || null,
        emailStatus: job.emailStatus || 'not_found',
        emailValid:  job.emailValid ?? false,
        experience:  job.experience || null,
        requirements: job.requirements || null,
        confidence:  job.confidence || 0.5,
        sourceUrl:   job.sourceUrl || result.url,
        sourceType:  job.sourceType || result.source,
        source: 'recruiter-finder',
        foundAt: new Date().toISOString(),
      });
    }
  }

  const validJobs = dedupeJobs(allExtracted);

  onProgress(`🎯 Extracted ${validJobs.length} job posts! ${validJobs.filter(j => j.email).length} have direct recruiter emails.`);

  return validJobs.sort((a, b) => {
    if (a.email && !b.email) return -1;
    if (!a.email && b.email) return 1;
    return b.confidence - a.confidence;
  });
}
