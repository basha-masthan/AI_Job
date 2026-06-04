import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import nodemailer from 'nodemailer';
import { getAllResumes, saveJob } from '@/lib/store';
import { getApiKey, getHunterKeys } from '@/lib/config';
import { generateResumeFromJD, generateApplicationToolkit, safeJSONParse, callGroq } from '@/lib/ai';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { getSession } from '@/lib/auth';

const dataDir = path.join(process.cwd(), 'data');
const runsFile = path.join(dataDir, 'autopilot-runs.json');
const autopilotFile = path.join(dataDir, 'autopilot.json');

const USER = {
  name: 'Masthan Basha Shaik',
  phone: '+91 78937 02635',
  email: 'official4basha@gmail.com',
  location: 'Bangalore, India',
  bio: "I enjoy building production-ready products end-to-end, from frontend to backend, databases, deployment, and automation. I've worked with React, Node.js, PostgreSQL, MongoDB, and AWS to build practical full-stack applications, while using AI tools like Claude, Gemini, GitHub Copilot, and Cursor to improve speed, debugging, and productivity. I bring a fast-learning mindset, ownership, and strong problem-solving skills.",
  portfolio: 'https://basha-portfolio.vercel.app/',
  linkedin: 'https://www.linkedin.com/in/masthan-basha-ms/',
  github: 'https://github.com/basha-masthan',
};

function sanitizeEmailText(text) {
  if (!text || typeof text !== 'string') return '';
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*\n?/i, '');
  t = t.replace(/\n?\s*```\s*$/, '');
  if (/^\s*\{/.test(t)) {
    try {
      const parsed = JSON.parse(t);
      if (parsed.body && typeof parsed.body === 'string') return parsed.body;
      if (parsed.text && typeof parsed.text === 'string') return parsed.text;
      if (typeof parsed === 'string') return parsed;
    } catch {}
  }
  t = t.replace(/^["']body["']\s*:\s*["']/i, '');
  t = t.replace(/["']\s*$/i, '');
  t = t.replace(/^\{.*?"body"\s*:\s*"/s, '');
  t = t.replace(/"\s*\}\s*$/s, '');
  t = t.replace(/\\n/g, '\n');
  t = t.replace(/\\"/g, '"');
  return t.trim();
}

function buildFallbackEmail(job, resumeLink) {
  const subject = `Application for ${job.title} position`;
  const body = `Hi ${job.company} Hiring Team,

I'm ${USER.name}, a full-stack engineer based in ${USER.location}.

${USER.bio}

Your ${job.title} role aligns with my experience building production-ready applications using modern tooling. I've shipped 3+ full-stack applications from scratch, handling frontend, backend, databases, and cloud deployment independently.

I'd welcome the chance to discuss how I can bring this same ownership and builder mindset to the ${job.title} role at ${job.company}.

${resumeLink ? `\uD83D\uDCC4 Tailored resume (PDF): ${resumeLink}\n` : '\uD83D\uDCC4 My tailored resume is attached to this email.\n'}
Portfolio:  ${USER.portfolio}
LinkedIn:  ${USER.linkedin}
GitHub:    ${USER.github}

Best regards,
${USER.name}
${USER.phone} \u00B7 ${USER.email}`;
  return { subject, body };
}

let activeEngine = null;

function ensureFiles() {
  for (const f of [runsFile, autopilotFile]) {
    if (!fs.existsSync(f)) {
      fs.writeFileSync(f, f === autopilotFile
        ? JSON.stringify({ active: false, logs: [] })
        : JSON.stringify({ runs: [] })
      );
    }
  }
}

function readRuns() {
  ensureFiles();
  try { return JSON.parse(fs.readFileSync(runsFile, 'utf-8')); }
  catch { return { runs: [] }; }
}

function writeRuns(data) {
  fs.writeFileSync(runsFile, JSON.stringify(data, null, 2));
}

function readAutopilot() {
  ensureFiles();
  try { return JSON.parse(fs.readFileSync(autopilotFile, 'utf-8')); }
  catch { return { active: false, logs: [] }; }
}

function writeAutopilot(state) {
  fs.writeFileSync(autopilotFile, JSON.stringify(state));
}

function addLog(title, message, type = 'info') {
  const state = readAutopilot();
  state.logs.unshift({ title, message, type, time: new Date().toISOString() });
  if (state.logs.length > 100) state.logs = state.logs.slice(0, 100);
  writeAutopilot(state);
}

export function getAutopilotState() {
  return readAutopilot();
}

export function getRuns(userId) {
  const data = readRuns();
  if (!userId) return data.runs;
  return data.runs.filter(r => r.userId === userId);
}

export function getActiveRun() {
  const runs = readRuns().runs;
  return runs.find(r => r.status === 'running' || r.status === 'paused') || null;
}

export async function startEngine({ targetRole, targetLocation, resumeId, userId, dailyCap = 50 }) {
  if (activeEngine) {
    throw new Error('Autopilot engine is already running.');
  }

  const resume = getAllResumes(userId).find(r => r.id === resumeId);
  if (!resume) throw new Error('Selected resume not found.');

  const run = {
    id: uuid(),
    userId,
    targetRole,
    targetLocation,
    resumeId,
    resumeProfile: resume.data || resume.extractedProfile,
    dailyCap,
    status: 'running',
    startedAt: new Date().toISOString(),
    stats: { searched: 0, matched: 0, prepared: 0, applied: 0, failed: 0 },
    jobs: [],
    currentBatch: 0,
  };

  const data = readRuns();
  data.runs.unshift(run);
  writeRuns(data);

  const state = readAutopilot();
  state.active = true;
  writeAutopilot(state);

  addLog('Autopilot Started', `Targeting: ${targetRole} ${targetLocation ? 'in ' + targetLocation : ''} | Daily cap: ${dailyCap} | Continuous mode: 30s between applications`, 'info');

  activeEngine = { runId: run.id, userId, resume, config: { targetRole, targetLocation, dailyCap } };
  runPipeline();
}

function getRun() {
  if (!activeEngine) return null;
  const data = readRuns();
  return data.runs.find(r => r.id === activeEngine.runId);
}

function updateRun(updates) {
  if (!activeEngine) return;
  const data = readRuns();
  const idx = data.runs.findIndex(r => r.id === activeEngine.runId);
  if (idx !== -1) {
    Object.assign(data.runs[idx], updates);
    writeRuns(data);
  }
}

function addJobToRun(job) {
  if (!activeEngine) return;
  const data = readRuns();
  const idx = data.runs.findIndex(r => r.id === activeEngine.runId);
  if (idx !== -1) {
    data.runs[idx].jobs.push(job);
    writeRuns(data);
  }
}

function updateJob(jobId, updates) {
  if (!activeEngine) return;
  const data = readRuns();
  const run = data.runs.find(r => r.id === activeEngine.runId);
  if (run) {
    const jIdx = run.jobs.findIndex(j => j.id === jobId);
    if (jIdx !== -1) {
      Object.assign(run.jobs[jIdx], updates);
      writeRuns(data);
    }
  }
}

async function runPipeline() {
  try {
    while (activeEngine) {
      const run = getRun();
      if (!run || run.status === 'stopped') break;
      if (run.status === 'paused') {
        await sleep(5000);
        continue;
      }

      const todayApps = run.jobs.filter(j =>
        j.status === 'applied' &&
        new Date(j.appliedAt).toDateString() === new Date().toDateString()
      ).length;

      if (todayApps >= run.dailyCap) {
        addLog('Daily Cap Reached', `Applied to ${todayApps} jobs today. Cap hit.`, 'info');
        updateRun({ status: 'completed' });
        stateComplete();
        break;
      }

      await stepSearch(run);
      await sleep(1000);

      await stepMatch(run);
      await sleep(1000);

      let keptApplying = true;
      while (keptApplying && activeEngine) {
        const currentRun = getRun();
        if (!currentRun || currentRun.status === 'stopped') break;
        if (currentRun.status === 'paused') { await sleep(3000); continue; }

        const todayCount = currentRun.jobs.filter(j =>
          j.status === 'applied' &&
          new Date(j.appliedAt).toDateString() === new Date().toDateString()
        ).length;
        if (todayCount >= currentRun.dailyCap) {
          addLog('Daily Cap Reached', `Reached ${todayCount} applications today.`, 'info');
          updateRun({ status: 'completed' });
          stateComplete();
          return;
        }

        const pendingMatch = currentRun.jobs.find(j => j.status === 'matched' && !j.processed);
        if (!pendingMatch) { keptApplying = false; break; }

        await stepPrepare(currentRun, pendingMatch);

        const prepared = getRun().jobs.find(j => j.id === pendingMatch.id && j.status === 'prepared');
        if (prepared) {
          await stepApply(currentRun, prepared);
        }

        if (activeEngine) {
          addLog('Cycle Rest', 'Waiting 30s before next application...', 'info');
          for (let i = 0; i < 30; i++) {
            if (!activeEngine) break;
            const r = getRun();
            if (!r || r.status === 'stopped') return;
            if (r.status === 'paused') { await sleep(3000); continue; }
            await sleep(1000);
          }
        }
      }

      if (activeEngine) {
        const runNow = getRun();
        const pendingJobs = (runNow?.jobs || []).filter(j => j.status === 'matched' && !j.processed);
        if (pendingJobs.length === 0) {
          addLog('No More Matches', 'Searching for new jobs in 30s...', 'info');
          for (let i = 0; i < 30; i++) {
            if (!activeEngine) break;
            const r = getRun();
            if (!r || r.status === 'stopped') return;
            if (r.status === 'paused') { await sleep(3000); continue; }
            await sleep(1000);
          }
        }
      }
    }
  } catch (err) {
    addLog('Pipeline Error', err.message, 'error');
    stateError(err.message);
  }
}

async function stepSearch(run) {
  addLog('Searching Jobs', `Searching for "${run.targetRole}" ${run.targetLocation ? 'in ' + run.targetLocation : ''}...`, 'info');
  updateRun({ currentBatch: run.currentBatch + 1 });

  try {
    const params = new URLSearchParams({
      query: run.targetRole,
      location: run.targetLocation || 'India',
      page: '1',
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/jobs/search?${params}`, {
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      addLog('Search Failed', `Job search API returned ${res.status}`, 'error');
      return;
    }

    const data = await res.json();
    const jobs = data.jobs || [];

    if (jobs.length === 0) {
      addLog('No Jobs Found', `No results for "${run.targetRole}". Will retry next cycle.`, 'info');
      return;
    }

    let added = 0;
    const existingIds = new Set(run.jobs.map(j => j.sourceId));

    for (const job of jobs) {
      if (!job.url || job.url === '#' || existingIds.has(job.id)) continue;
      if (job.company === 'Company' || !job.company) continue;

      const newJob = {
        id: uuid(),
        sourceId: job.id,
        title: job.title || run.targetRole,
        company: job.company,
        location: job.location || run.targetLocation || 'Remote',
        description: job.description || '',
        url: job.url,
        salary: job.salary || 'Competitive',
        source: job.source || 'Search',
        score: 0,
        status: 'pending',
        processed: false,
        createdAt: new Date().toISOString(),
      };

      addJobToRun(newJob);
      existingIds.add(job.id);
      added++;
    }

    const stats = getRun().stats;
    stats.searched = (stats.searched || 0) + added;
    updateRun({ stats });

    addLog('Jobs Found', `Found ${jobs.length} jobs, added ${added} new unique ones.`, 'success');
  } catch (err) {
    addLog('Search Error', `Job search failed: ${err.message}`, 'error');
  }
}

async function stepPreFilter(run) {
  const pending = getRun().jobs.filter(j => j.status === 'pending');
  if (pending.length === 0) return { kept: 0, filtered: 0 };

  addLog('Pre-Filtering', `Checking ${pending.length} jobs for title + experience match...`, 'info');

  const resumeProfile = run.resumeProfile;
  const userTitle = run.targetRole || '';
  const userExperience = resumeProfile?.experience?.[0]?.role || 'Full-Stack Developer';

  let kept = 0;
  let filtered = 0;

  for (const job of pending) {
    try {
      const system = `You are a strict job title + experience matchmaker. Return ONLY raw JSON, no markdown, no fences.`;
      const user = `TARGET ROLE (user's choice): "${userTitle}"
CANDIDATE CURRENT/PREVIOUS TITLES: ${userExperience}
CANDIDATE EXPERIENCE (years/level): ${(resumeProfile?.experience || []).map(e => `${e.role} at ${e.company} (${e.duration})`).join('; ')}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description (first 1500 chars): ${(job.description || '').substring(0, 1500)}

TASK: Decide if this job is a REAL fit for the user.
- Title alignment: is the role similar/adjacent to "${userTitle}"? (e.g. "Node.js Developer" matches "Backend Developer" but not "Marketing Manager")
- Experience level: does the JD's required experience roughly match what the candidate has?
- If BOTH align, this job should be processed (return match=true).
- If title is fundamentally different domain OR requires 5+ years more experience than candidate has, skip it.

Return JSON only:
{"match": true/false, "reason": "one short sentence"}`;

      const text = await callGroq([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ], 512);

      const cleaned = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/, '');
      let result = null;
      try { result = JSON.parse(cleaned); } catch {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) { try { result = JSON.parse(m[0]); } catch {} }
      }

      const isMatch = result?.match === true;
      if (isMatch) {
        kept++;
      } else {
        updateJob(job.id, { status: 'filtered_out', filterReason: result?.reason || 'Title/experience mismatch', processed: true });
        filtered++;
      }
    } catch (err) {
      kept++;
    }
  }

  if (filtered > 0) {
    addLog('Pre-Filtered', `Kept ${kept}, filtered out ${filtered} (title/experience mismatch)`, 'info');
  } else {
    addLog('Pre-Filter OK', `All ${kept} jobs passed title + experience check`, 'success');
  }

  return { kept, filtered };
}

async function stepMatch(run) {
  const pending = getRun().jobs.filter(j => j.status === 'pending');
  if (pending.length === 0) return;

  await stepPreFilter(run);

  const stillPending = getRun().jobs.filter(j => j.status === 'pending');
  if (stillPending.length === 0) return;

  addLog('Matching Jobs', `Scoring ${pending.length} jobs against your resume...`, 'info');

  const resumeProfile = run.resumeProfile;
  if (!resumeProfile) {
    addLog('Match Skipped', 'No resume profile available for matching.', 'error');
    return;
  }

  const BATCH_SIZE = 5;
  const batch = pending.slice(0, BATCH_SIZE);

  for (const job of batch) {
    try {
      const system = `You are an expert AI Job Matcher. Compare a CANDIDATE PROFILE against a JOB and rate the fit 0-100. Return ONLY a JSON object: {"score": 0-100, "reason": "1 sentence"}`;

      const user = `CANDIDATE PROFILE:
${JSON.stringify(resumeProfile)}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
DESCRIPTION: ${(job.description || '').substring(0, 3000)}

Rate how well this candidate fits this job. Score 0-100. Be strict. 85+ means excellent match.`;

      const text = await callGroq([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ], 1024);

      const result = safeJSONParse(text, { score: 50, reason: 'AI parse failed' });
      const score = Math.min(100, Math.max(0, result.score || 50));

      updateJob(job.id, { score, matchReason: result.reason || '', status: 'matched' });

      if (score >= 65) {
        addLog('Good Match', `${job.title} @ ${job.company} — Score: ${score}%`, 'success');
      }
    } catch (err) {
      updateJob(job.id, { score: 40, status: 'matched', matchError: err.message });
    }
  }

  const stats = getRun().stats;
  stats.matched = (stats.matched || 0) + batch.length;
  updateRun({ stats });
}

async function stepPrepare(run, job) {
  if (job.status !== 'matched' || job.processed) return;

  addLog('Preparing Application', `Adapting resume for ${job.title} @ ${job.company}...`, 'info');

  let resumeData = null;
  let cloudinaryUrl = null;
  let cloudinaryId = null;
  let coverLetter = '';
  let emailBodyData = null;

  try {
    const jdText = `${job.title} at ${job.company}\n${job.description || ''}\nLocation: ${job.location}\nSalary: ${job.salary}`;

    resumeData = await generateResumeFromJD(jdText, run.resumeProfile, false);

    const resumePayload = {
      name: resumeData.name || 'Resume',
      jobTitle: job.title,
      company: job.company,
      data: resumeData,
    };

    try {
      const pdfBuffer = Buffer.from(JSON.stringify(resumePayload, null, 2));
      const cloudResult = await uploadToCloudinary(pdfBuffer, `autopilot_${job.id}_${Date.now()}`, 'raw');
      cloudinaryUrl = cloudResult.secure_url;
      cloudinaryId = cloudResult.public_id;
    } catch (cloudErr) {
      addLog('Cloudinary Upload Failed', `Resume PDF upload error: ${cloudErr.message} — will retry at send time.`, 'info');
    }

    try {
      const toolkit = await generateApplicationToolkit(jdText, run.resumeProfile);
      coverLetter = toolkit?.coverLetter || '';
    } catch (toolErr) {
      coverLetter = '';
    }

    emailBodyData = await generateApplyEmail(run, job, coverLetter);

    updateJob(job.id, {
      status: 'prepared',
      resumeData,
      resumeCloudinaryUrl: cloudinaryUrl,
      resumeCloudinaryId: cloudinaryId,
      coverLetter,
      emailBody: emailBodyData,
    });

    const stats = getRun().stats;
    stats.prepared = (stats.prepared || 0) + 1;
    updateRun({ stats });

    addLog('Application Prepared', `Resume adapted + cover letter ready for ${job.title} @ ${job.company}`, 'success');
  } catch (err) {
    addLog('Prepare Partial', `Some parts failed for ${job.title} @ ${job.company}: ${err.message} — using fallback content.`, 'info');
    if (!emailBodyData) {
      emailBodyData = buildFallbackEmail(job, cloudinaryUrl);
    }
    updateJob(job.id, {
      status: 'prepared',
      resumeData: resumeData || run.resumeProfile,
      resumeCloudinaryUrl: cloudinaryUrl,
      resumeCloudinaryId: cloudinaryId,
      coverLetter: coverLetter || '',
      emailBody: emailBodyData,
    });
    const stats = getRun().stats;
    stats.prepared = (stats.prepared || 0) + 1;
    updateRun({ stats });
  }
}

async function generateApplyEmail(run, job, coverLetter) {
  const system = `You are a professional career coach writing cold-application emails that get responses.

TONE: Professional, direct, confident. No fluff, no "I am excited to apply" filler. Every sentence earns its place.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown, no code fences, no explanations.
- The "body" field must be plain text prose, NOT nested JSON.
- Keep the body to 4-5 short paragraphs. No walls of text.
- Do NOT use templates like [Name], [Company], etc. Write as the candidate.
- Include a specific tie between the candidate's experience and the JD requirements.`;

  const user = `Write a job application email for:

ROLE: ${job.title}
COMPANY: ${job.company}
LOCATION: ${job.location}
JOB DESCRIPTION: ${(job.description || '').substring(0, 2500)}

CANDIDATE DETAILS:
Name: ${USER.name}
Current Title: Full-Stack Engineer
Location: ${USER.location}
Phone: ${USER.phone}
Email: ${USER.email}

CANDIDATE STORY (use this voice):
${USER.bio}

CANDIDATE SKILLS: ${JSON.stringify(run.resumeProfile?.skills || [])}

${coverLetter ? `COVER LETTER EXCERPT:\n${coverLetter.substring(0, 800)}` : ''}

STRUCTURE THE EMAIL LIKE THIS:

Subject: "Application for {Role} — {2-3 words that make you stand out}"

Body:
1. Greeting ("Hi {Company} team,")
2. One-line intro: who you are and what you build
3. Why THIS role at THIS company (tie 1-2 JD requirements to your real experience)
4. One line about what makes you different (fast learner, ownership, builder)
5. Mention resume is attached + Cloudinary link placeholder
6. Links: Portfolio | LinkedIn | GitHub
7. Sign-off with name, phone, email

Return EXACTLY this JSON format (no markdown, no fences):
{"subject":"Application for {Role} — your standout hook here","body":"Hi {Company} team,\\n\\nI'm Masthan Basha Shaik...\\n\\n...\\n\\nBest regards,\\nMasthan Basha Shaik\\n+91 78937 02635 \\u00B7 official4basha@gmail.com"}

REMEMBER: body is plain text. Escape newlines as \\\\n. Escape quotes as \\\\". Return raw JSON.`;

  try {
    const text = await callGroq([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], 4096);

    const cleaned = sanitizeEmailText(text);
    if (cleaned && cleaned.length > 100 && !/^\{/.test(cleaned)) {
      return { subject: `Application for ${job.title} — Full-Stack Engineer`, body: cleaned };
    }

    const parsed = safeJSONParse(text);
    if (parsed?.body && typeof parsed.body === 'string' && parsed.body.length > 80) {
      return { subject: parsed.subject || `Application for ${job.title}`, body: parsed.body };
    }

    return buildFallbackEmail(job, '');
  } catch {
    return buildFallbackEmail(job, '');
  }
}

async function stepApply(run, job) {
  if (job.status !== 'prepared' || job.processed) return;

  addLog('Applying', `Sending application for ${job.title} @ ${job.company}...`, 'info');

  const MAX_RETRIES = 2;
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      const email = await findCompanyEmail(job.company, job.url);

      if (!email) {
        addLog('Skipped - No Email', `Could not find email for ${job.company}. Skipping.`, 'error');
        updateJob(job.id, { status: 'failed', error: 'No email found', processed: true });
        const stats = getRun().stats;
        stats.failed = (stats.failed || 0) + 1;
        updateRun({ stats });
        return;
      }

      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpUser || !smtpPass) {
        addLog('SMTP Missing', 'Configure SMTP credentials in .env.local.', 'error');
        updateJob(job.id, { status: 'failed', error: 'SMTP not configured', processed: true });
        const stats = getRun().stats;
        stats.failed = (stats.failed || 0) + 1;
        updateRun({ stats });
        return;
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      let emailSubject = (job.emailBody?.subject) || `Application for ${job.title}`;
      let emailBody = sanitizeEmailText(job.emailBody?.body) || sanitizeEmailText(job.coverLetter) || '';

      emailSubject = sanitizeEmailText(emailSubject);
      if (emailSubject.length < 5) emailSubject = `Application for ${job.title}`;

      let resumeLink = job.resumeCloudinaryUrl || '';
      let resumeBuffer = null;

      if (job.resumeData && (!resumeLink || retries > 0)) {
        try {
          const pdfBuffer = Buffer.from(JSON.stringify({
            name: job.resumeData.name || USER.name,
            jobTitle: job.title,
            company: job.company,
            data: job.resumeData,
          }, null, 2));
          const freshUpload = await uploadToCloudinary(pdfBuffer, `autopilot_${job.id}_${Date.now()}`, 'raw');
          resumeLink = freshUpload.secure_url;
          updateJob(job.id, { resumeCloudinaryUrl: freshUpload.secure_url, resumeCloudinaryId: freshUpload.public_id });
          addLog('Fresh Upload', `Re-uploaded resume for ${job.company}`, 'info');
        } catch (uploadErr) {}
      }

      if (resumeLink) {
        try {
          const resumeRes = await fetch(resumeLink);
          if (resumeRes.ok) {
            resumeBuffer = Buffer.from(await resumeRes.arrayBuffer());
          }
        } catch {}
      }

      const linkBlock = resumeLink
        ? `\uD83D\uDCC4 Tailored resume (PDF): ${resumeLink}`
        : '\uD83D\uDCC4 My tailored resume is attached to this email.';

      if (/^\s*\{/.test(emailBody) || emailBody.length < 100) {
        const fallback = buildFallbackEmail(job, resumeLink);
        emailBody = fallback.body;
        emailSubject = fallback.subject;
      }

      if (resumeLink && !emailBody.includes(resumeLink) && !emailBody.includes('{{RESUME_LINK}}')) {
        emailBody += `\n\n${linkBlock}`;
      }

      if (!emailBody.includes(USER.portfolio)) {
        emailBody += `\n\nPortfolio:  ${USER.portfolio}\nLinkedIn:  ${USER.linkedin}\nGitHub:    ${USER.github}`;
      }

      const mailOptions = {
        from: `"${USER.name}" <${smtpUser}>`,
        to: email,
        subject: emailSubject.trim(),
        text: emailBody.trim(),
      };

      if (resumeBuffer) {
        mailOptions.attachments = [{
          filename: `Resume_${USER.name.replace(/\s+/g, '_')}.pdf`,
          content: resumeBuffer,
        }];
      }

      await transporter.sendMail(mailOptions);

      const savedJob = {
        id: uuid(),
        title: job.title,
        company: job.company,
        role: job.title,
        location: job.location,
        salary: job.salary,
        url: job.url,
        description: job.description,
        status: 'applied',
        source: 'autopilot',
        appliedEmail: email,
        userId: run.userId,
        dateApplied: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      saveJob(savedJob, run.userId);

      updateJob(job.id, {
        status: 'applied',
        appliedAt: new Date().toISOString(),
        appliedEmail: email,
        processed: true,
        savedJobId: savedJob.id,
      });

      const stats = getRun().stats;
      stats.applied = (stats.applied || 0) + 1;
      updateRun({ stats });

      addLog('Application Sent', `\u2705 ${job.title} @ ${job.company} \u2192 ${email}`, 'success');
      return;

    } catch (err) {
      const errMsg = err.message || '';
      const isTransient = /ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|temporarily|too many/i.test(errMsg);

      if (retries < MAX_RETRIES && isTransient) {
        retries++;
        addLog('Retrying', `${job.title} @ ${job.company}: ${errMsg} — retry ${retries}/${MAX_RETRIES} in 10s...`, 'info');
        await sleep(10000);
        continue;
      }

      updateJob(job.id, { status: 'failed', error: err.message, processed: true });
      const stats = getRun().stats;
      stats.failed = (stats.failed || 0) + 1;
      updateRun({ stats });
      addLog('Application Failed', `${job.title} @ ${job.company}: ${err.message}`, 'error');
      return;
    }
  }
}

async function findCompanyEmail(companyName, jobUrl) {
  const domain = extractDomain(companyName, jobUrl);
  if (!domain) return null;

  const defaultEmail = `careers@${domain}`;
  const hunterKeys = getHunterKeys();

  for (const key of hunterKeys) {
    if (!key) continue;
    try {
      const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${key}&limit=3`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        if (res.status === 429) continue;
        continue;
      }
      const data = await res.json();
      if (data.data?.emails?.length > 0) {
        const hrEmail = data.data.emails.find(e =>
          /hr|career|hiring|recruit|talent|jobs|people/i.test(e.value)
        );
        return hrEmail?.value || data.data.emails[0].value;
      }
    } catch {}
  }

  return defaultEmail;
}

function extractDomain(companyName, jobUrl) {
  if (jobUrl) {
    try {
      const u = new URL(jobUrl);
      const hostParts = u.hostname.replace('www.', '').split('.');
      if (hostParts.length >= 2) return hostParts.slice(0, 2).join('.');
    } catch {}
  }

  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/(inc|llc|ltd|technologies|tech|solutions|services|group|corp)$/i, '')
    .trim() + '.com';
}

export async function stopEngine() {
  if (!activeEngine) {
    const activeRun = getActiveRun();
    if (activeRun) {
      updateRunForId(activeRun.id, { status: 'stopped' });
    }
    const state = readAutopilot();
    state.active = false;
    state.logs.unshift({ title: 'Autopilot Stopped', message: 'User requested to stop autopilot.', type: 'info', time: new Date().toISOString() });
    writeAutopilot(state);
    return;
  }

  const run = getRun();
  if (run) {
    updateRun({ status: 'stopped' });
  }

  activeEngine = null;

  const state = readAutopilot();
  state.active = false;
  state.logs.unshift({ title: 'Autopilot Stopped', message: 'User requested to stop autopilot.', type: 'info', time: new Date().toISOString() });
  writeAutopilot(state);
}

export async function pauseEngine() {
  const run = getRun();
  if (run) {
    updateRun({ status: 'paused' });
    addLog('Autopilot Paused', 'Pipeline paused. Resume to continue.', 'info');
  }
}

export async function resumeEngine() {
  const run = getRun();
  if (run) {
    updateRun({ status: 'running' });
    addLog('Autopilot Resumed', 'Pipeline continuing...', 'info');
  }
}

function updateRunForId(runId, updates) {
  const data = readRuns();
  const idx = data.runs.findIndex(r => r.id === runId);
  if (idx !== -1) {
    Object.assign(data.runs[idx], updates);
    writeRuns(data);
  }
}

function stateComplete() {
  const state = readAutopilot();
  state.active = false;
  writeAutopilot(state);
  activeEngine = null;
}

function stateError(message) {
  const state = readAutopilot();
  state.active = false;
  state.logs.unshift({ title: 'Autopilot Error', message, type: 'error', time: new Date().toISOString() });
  writeAutopilot(state);
  activeEngine = null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
