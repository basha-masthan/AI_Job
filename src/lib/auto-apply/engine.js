import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuid } from 'uuid';
import nodemailer from 'nodemailer';
import { getApiKey } from '@/lib/config';
import { invokeAI, safeJSONParse, generateResumeFromJD, generateApplicationEmail } from '@/lib/ai';
import { saveJob, checkAlreadyApplied, checkAlreadyAppliedByEmail, getAllResumes } from '@/lib/store';
import { findCompanyEmail } from '@/lib/email-discovery';
import { generateAndUploadResumePDF } from '@/lib/pdf-generator';
import { searchJobs } from './search';

const USER = {
  name: 'Masthan Basha Shaik',
  email: 'official4basha@gmail.com',
  phone: '+91 78937 02635',
  location: 'Bangalore, India',
  portfolio: 'https://basha-portfolio.vercel.app/',
  linkedin: 'https://www.linkedin.com/in/masthan-basha-ms/',
  github: 'https://github.com/basha-masthan',
  bio: "Full-stack engineer with experience building production-ready products end-to-end from frontend to backend, databases, deployment, and automation.",
};

const dataDir = path.join(process.cwd(), 'data');
const runsFile = path.join(dataDir, 'auto-apply-runs.json');

let activeEngine = null;
let _fsWritable = null;

function isFsWritable() {
  if (_fsWritable !== null) return _fsWritable;
  try {
    const tmp = path.join(os.tmpdir(), `fbt_write_test_${Date.now()}`);
    fs.writeFileSync(tmp, 'test');
    fs.unlinkSync(tmp);
    _fsWritable = true;
  } catch { _fsWritable = false; }
  return _fsWritable;
}

function ensureFile() {
  if (!isFsWritable()) return;
  try {
    if (!fs.existsSync(runsFile)) {
      fs.writeFileSync(runsFile, JSON.stringify({ runs: [] }));
    }
  } catch {}
}

function readRuns() {
  ensureFile();
  try {
    if (isFsWritable()) return JSON.parse(fs.readFileSync(runsFile, 'utf-8'));
  } catch {}
  return { runs: [] };
}

function writeRuns(data) {
  if (!isFsWritable()) return;
  try { fs.writeFileSync(runsFile, JSON.stringify(data, null, 2)); } catch {}
}

function createRun({ userId, targetRole, targetLocation, experienceLevels, resumeId, dailyCap, stepMode, smtp }) {
  const allResumes = getAllResumes(userId);
  const resume = allResumes.find(r => r.id === resumeId);
  if (!resume) throw new Error('Resume not found');

  const run = {
    id: uuid(),
    userId,
    targetRole,
    targetLocation: targetLocation || 'India',
    experienceLevels: experienceLevels || [],
    dailyCap: dailyCap || 50,
    stepMode: stepMode !== false,
    resumeId,
    resumeProfile: resume.data || resume.extractedProfile || resume,
    status: 'running',
    startedAt: new Date().toISOString(),
    stats: { searched: 0, scored: 0, prepared: 0, applied: 0, failed: 0, skipped: 0 },
    jobs: [],
    logs: [],
    currentJobIndex: 0,
    smtp: smtp || null,
  };

  const data = readRuns();
  data.runs.unshift(run);
  writeRuns(data);
  return run;
}

function getRun(runId) {
  const data = readRuns();
  return data.runs.find(r => r.id === runId) || null;
}

function updateRun(runId, updates) {
  const data = readRuns();
  const idx = data.runs.findIndex(r => r.id === runId);
  if (idx === -1) return;
  Object.assign(data.runs[idx], updates);
  writeRuns(data);
}

function saveRunJob(runId, job) {
  const data = readRuns();
  const run = data.runs.find(r => r.id === runId);
  if (!run) return;
  run.jobs.push(job);
  writeRuns(data);
}

function updateRunJob(runId, jobId, updates) {
  const data = readRuns();
  const run = data.runs.find(r => r.id === runId);
  if (!run) return;
  const j = run.jobs.find(j => j.id === jobId);
  if (!j) return;
  Object.assign(j, updates);
  writeRuns(data);
}

function addRunLog(runId, title, message, type = 'info') {
  const log = { title, message, type, time: new Date().toISOString() };
  const data = readRuns();
  const run = data.runs.find(r => r.id === runId);
  if (!run) return;
  run.logs.unshift(log);
  if (run.logs.length > 100) run.logs = run.logs.slice(0, 100);
  writeRuns(data);
  return log;
}

function incRunStat(runId, statName, amount = 1) {
  const run = getRun(runId);
  if (!run) return;
  run.stats[statName] = (run.stats[statName] || 0) + amount;
  updateRun(runId, { stats: run.stats });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function isActive() {
  return activeEngine !== null;
}

async function getResumeCloudinaryUrl(resumeId, userId) {
  try {
    const allResumes = getAllResumes(userId);
    const resume = allResumes.find(r => r.id === resumeId);
    return resume?.cloudinaryUrl || null;
  } catch {
    return null;
  }
}

export function getStatus() {
  if (activeEngine) {
    const run = getRun(activeEngine.runId);
    if (run) return { active: true, run };
    activeEngine = null;
  }
  const data = readRuns();
  const activeRun = data.runs.find(r => r.status === 'running' || r.status === 'paused');
  if (activeRun) return { active: true, run: activeRun };
  return { active: false, run: null, recent: data.runs.slice(0, 5) };
}

export function getRuns() {
  return readRuns().runs;
}

export async function startEngine(params) {
  if (activeEngine) throw new Error('Engine already running');
  const run = createRun(params);
  activeEngine = { runId: run.id };
  addRunLog(run.id, 'Started', `Auto-apply pipeline started for ${run.targetRole}`, 'success');
  runPipeline(run.id);
  return run;
}

export function stopEngine() {
  if (activeEngine) {
    updateRun(activeEngine.runId, { status: 'stopped' });
    addRunLog(activeEngine.runId, 'Stopped', 'User stopped the engine', 'info');
    activeEngine = null;
  }
}

export function pauseEngine() {
  if (activeEngine) {
    updateRun(activeEngine.runId, { status: 'paused' });
    addRunLog(activeEngine.runId, 'Paused', 'Engine paused', 'info');
  }
}

export function resumeEngine() {
  if (activeEngine) {
    const run = getRun(activeEngine.runId);
    if (run && run.status === 'paused') {
      updateRun(activeEngine.runId, { status: 'running' });
      addRunLog(activeEngine.runId, 'Resumed', 'Engine resuming', 'info');
      runPipeline(activeEngine.runId);
    }
  }
}

async function runPipeline(runId) {
  try {
    while (activeEngine && activeEngine.runId === runId) {
      const run = getRun(runId);
      if (!run || run.status === 'stopped') { activeEngine = null; break; }
      if (run.status === 'paused') { await sleep(3000); continue; }

      const todayApplied = run.jobs.filter(j =>
        j.status === 'applied' &&
        j.appliedAt && new Date(j.appliedAt).toDateString() === new Date().toDateString()
      ).length;

      if (todayApplied >= run.dailyCap) {
        addRunLog(runId, 'Daily Cap', `Applied to ${todayApplied} today. Cap reached.`, 'success');
        updateRun(runId, { status: 'completed' });
        activeEngine = null;
        break;
      }

      const pending = run.jobs.filter(j => j.status === 'pending' || j.status === 'matched');
      const unmatched = run.jobs.filter(j => j.status === 'pending');

      if (pending.length === 0) {
        if (run.searchPhase === 'exhausted') {
          addRunLog(runId, 'Search', 'Search sources exhausted. No more jobs found.', 'info');
          updateRun(runId, { status: 'completed' });
          activeEngine = null;
          break;
        }
        await stepSearch(run);
        await sleep(2000);
        continue;
      }

      if (run.stepMode) {
        const nextJob = pending[0];
        await processJob(runId, nextJob);
        await sleep(3000);
      } else {
        const batch = pending.slice(0, 5);
        for (const job of batch) {
          if (!isActive()) break;
          await processJob(runId, job);
          await sleep(2000);
        }
      }

      const runAfter = getRun(runId);
      if (runAfter && runAfter.jobs.every(j => j.processed || j.status === 'applied' || j.status === 'failed' || j.status === 'skipped')) {
        updateRun(runId, { status: 'completed' });
        addRunLog(runId, 'Complete', 'All jobs processed', 'success');
        activeEngine = null;
        break;
      }
    }
  } catch (err) {
    console.error('[Auto-Apply Pipeline Error]', err.message);
    if (activeEngine) {
      addRunLog(runId, 'Error', err.message, 'error');
      await sleep(30000);
      if (activeEngine && getRun(runId)?.status === 'running') {
        runPipeline(runId);
      } else {
        activeEngine = null;
      }
    }
  }
}

async function stepSearch(run) {
  addRunLog(run.id, 'Search', `🔍 Searching for ${run.targetRole} jobs...`, 'info');
  updateRun(run.id, { searchPhase: 'discovering' });

  const progressFn = (phase, message, current, total) => {
    updateRun(run.id, {
      searchPhase: phase,
      searchMessage: message,
      searchProgress: { current, total },
    });
    addRunLog(run.id, phase === 'scraping' ? 'Scraping' : 'Search', message, 'info');
  };

  const isEngineRunning = () => !!(activeEngine && activeEngine.runId === run.id && getRun(run.id)?.status === 'running');

  const result = await searchJobs({
    targetRole: run.targetRole,
    targetLocation: run.targetLocation,
    experienceLevels: run.experienceLevels,
    skills: run.resumeProfile?.skills?.technical || [],
  }, progressFn, isEngineRunning);

  if (result.jobs.length === 0) {
    const emptyCount = (run.emptySearchCount || 0) + 1;
    addRunLog(run.id, 'Search', `⚠️ Empty search (${emptyCount}/3): ${result.message || 'No jobs found'}`, 'warning');
    if (emptyCount >= 3) {
      updateRun(run.id, { searchPhase: 'exhausted', searchMessage: 'Search sources exhausted after 3 empty rounds', emptySearchCount: emptyCount });
      return;
    }
    updateRun(run.id, { emptySearchCount: emptyCount, searchMessage: result.message || 'No jobs found' });
    return;
  }

  updateRun(run.id, { emptySearchCount: 0 }); // reset counter on success

  const existingIds = new Set(run.jobs.map(j => j.sourceId || j.id));
  let added = 0;

  for (const job of result.jobs) {
    if (existingIds.has(job.id)) continue;
    const jobEntry = {
      ...job,
      sourceId: job.id,
      status: 'pending',
      processed: false,
      score: 0,
    };
    saveRunJob(run.id, jobEntry);
    existingIds.add(job.id);
    added++;
  }

  incRunStat(run.id, 'searched', added);
  addRunLog(run.id, 'Search', `✅ Found ${added} verified jobs`, 'success');
  updateRun(run.id, { searchPhase: 'complete' });
}

export async function atsScoreJob(job, resumeProfile) {
  const resumeText = [
    (resumeProfile?.skills?.technical || []).join(' '),
    (resumeProfile?.skills?.tools || []).join(' '),
    (resumeProfile?.experience || []).map(e => `${e.role} ${e.company} ${(e.bullets || []).join(' ')}`).join(' '),
    resumeProfile?.summary || '',
  ].join(' ').toLowerCase();

  const jobText = [job.title, job.company, job.description || ''].join(' ').toLowerCase();

  const importantCategories = [
    ['javascript', 'react', 'angular', 'vue', 'typescript', 'nodejs', 'node', 'nextjs', 'next'],
    ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy'],
    ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'ci/cd', 'terraform'],
    ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'graphql'],
    ['git', 'agile', 'scrum', 'rest', 'api', 'microservices', 'testing'],
  ];

  let matches = 0, total = 0;
  for (const cat of importantCategories) {
    if (cat.some(w => jobText.includes(w))) {
      total += 15;
      if (cat.some(w => resumeText.includes(w))) matches += 15;
    }
  }

  const expLevels = ['fresher', 'entry level', '0-1', 'junior', 'senior', 'lead', '5+'];
  const resumeHasExp = expLevels.some(e => resumeText.includes(e));
  const jobHasExp = expLevels.some(e => jobText.includes(e));
  if (resumeHasExp || jobHasExp) { total += 40; if (resumeHasExp && jobHasExp) matches += 40; }

  const techKeywords = ['developer', 'engineer', 'programmer', 'software', 'fullstack', 'frontend', 'backend', 'devops', 'data'];
  if (techKeywords.some(k => job.title?.toLowerCase().includes(k))) {
    total += 10; matches += 5;
  }

  let score = total > 0 ? Math.round((matches / total) * 100) : 40;

  if (score >= 45 && score <= 80) {
    try {
      const system = 'ATS expert. Score resume vs JD. Return JSON: {"score":0-100,"reason":"1 sentence"}';
      const user = `JOB: ${job.title} at ${job.company}\n${(job.description || '').substring(0, 1500)}\nSKILLS: ${JSON.stringify(resumeProfile?.skills || {})}\nScore 0-100.`;
      const text = await Promise.race([
        invokeAI(system, user, 256),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ]);
      const result = safeJSONParse(text, { score, reason: 'keyword' });
      const aiScore = Math.min(100, Math.max(0, result.score || score));
      if (Math.abs(aiScore - score) > 5) score = aiScore;
    } catch {}
  }

  return Math.min(100, Math.max(0, score));
}

async function processJob(runId, job) {
  const run = getRun(runId);
  if (!run || job.processed) return;

  addRunLog(runId, 'Processing', `${job.title} @ ${job.company}`, 'info');

  try {
    const emailExists = job.appliedEmail && await checkAlreadyAppliedByEmail(job.appliedEmail, run.userId);
    if (emailExists) {
      updateRunJob(runId, job.id, { status: 'skipped', processed: true, skipReason: `Already sent to ${job.appliedEmail}` });
      incRunStat(runId, 'skipped');
      addRunLog(runId, 'Duplicate', `Already sent to ${job.appliedEmail} — skipping`, 'info');
      return;
    }

    const alreadyApplied = await checkAlreadyApplied(job.company, job.title, run.userId);
    if (alreadyApplied) {
      updateRunJob(runId, job.id, { status: 'skipped', processed: true, skipReason: 'Already applied' });
      incRunStat(runId, 'skipped');
      addRunLog(runId, 'Skipped', `${job.title} @ ${job.company} — already applied`, 'info');
      return;
    }

    // ── 1. Find email first ──────────────────────────────
    let emails = [];
    const directEmail = job.appliedEmail || job.directEmail;
    if (directEmail) {
      emails = [directEmail];
      addRunLog(runId, 'Email', `Using direct email from job post: ${directEmail}`, 'success');
    } else {
      emails = await findCompanyEmail(job.company, job.url);
    }

    if (!emails || emails.length === 0) {
      updateRunJob(runId, job.id, { status: 'failed', error: 'No email found', processed: true });
      incRunStat(runId, 'failed');
      addRunLog(runId, 'No Email', `Could not find HR email for ${job.company}`, 'error');
      return;
    }

    addRunLog(runId, 'Email', `Found ${emails.length} contact(s) for ${job.company}`, 'success');

    // ── 2. Prepare the resume (ATS check & tailor) ──────────────────────────────
    let activeResumeProfile = run.resumeProfile;
    let activeResumeId = run.resumeId;
    let score = await atsScoreJob(job, activeResumeProfile);
    
    addRunLog(runId, 'ATS Score Check', `Default resume score: ${score}%`, 'info');

    let resumeUrl = null;

    if (score < 70) {
      addRunLog(runId, 'ATS Score Check', `Score is < 70%. Checking other resumes in vault...`, 'info');
      try {
        const allResumes = getAllResumes(run.userId);
        let bestScore = score;
        let bestResume = null;

        for (const resItem of allResumes) {
          if (resItem.id === run.resumeId) continue;
          const resProfile = resItem.data || resItem.extractedProfile || resItem;
          const otherScore = await atsScoreJob(job, resProfile);
          if (otherScore > bestScore) {
            bestScore = otherScore;
            bestResume = resItem;
          }
        }

        if (bestScore >= 70 && bestResume) {
          activeResumeProfile = bestResume.data || bestResume.extractedProfile || bestResume;
          activeResumeId = bestResume.id;
          score = bestScore;
          resumeUrl = bestResume.cloudinaryUrl || null;
          addRunLog(runId, 'ATS Match Success', `Found better resume in vault: "${bestResume.fileName || bestResume.name}" (${score}%)`, 'success');
        }
      } catch (err) {
        console.error('[Engine Scan Vault Resumes Error]', err.message);
      }
    }

    updateRunJob(runId, job.id, { score, status: 'matched' });
    incRunStat(runId, 'scored');
    addRunLog(runId, 'ATS Score', `${job.title} — ${score}%`, 'success');

    if (score < 70) {
      addRunLog(runId, 'Resume', `Generating tailored resume (ATS ${score}%)...`, 'info');
      try {
        const jdText = `${job.title} at ${job.company}\n${job.description || ''}`;
        const newResume = await generateResumeFromJD(jdText, activeResumeProfile);
        if (newResume) {
          const pdfData = await generateAndUploadResumePDF(newResume, `resume_${job.id}`);
          resumeUrl = pdfData?.url || null;
          incRunStat(runId, 'prepared');
          addRunLog(runId, 'Resume', `Tailored resume created for ${job.company}`, 'success');
        }
      } catch (err) {
        addRunLog(runId, 'Resume', `PDF generation failed: ${err.message}`, 'warning');
      }
    }

    const smtpHost = run.smtp?.host;
    const smtpPort = parseInt(run.smtp?.port || '587');
    const smtpUser = run.smtp?.user;
    const smtpPass = run.smtp?.pass;

    if (!smtpUser || !smtpPass) {
      updateRunJob(runId, job.id, { status: 'failed', error: 'SMTP not configured. Go to Profile > Email Setup to configure your Gmail App Password.', processed: true });
      incRunStat(runId, 'failed');
      addRunLog(runId, 'SMTP', 'SMTP not configured', 'error');
      return;
    }

    const profile = activeResumeProfile || {};
    const candidateName = profile.name || USER.name;
    const candidateEmail = profile.contact?.email || USER.email;
    const candidatePhone = profile.contact?.phone || USER.phone;
    const candidateLocation = profile.contact?.location || USER.location;
    const candidateLinkedin = profile.contact?.linkedin
      ? (profile.contact.linkedin.startsWith('http') ? profile.contact.linkedin : `https://${profile.contact.linkedin}`)
      : USER.linkedin;
    const candidateGithub = profile.contact?.github
      ? (profile.contact.github.startsWith('http') ? profile.contact.github : `https://${profile.contact.github}`)
      : USER.github;
    const candidatePortfolio = profile.contact?.portfolio
      ? (profile.contact.portfolio.startsWith('http') ? profile.contact.portfolio : `https://${profile.contact.portfolio}`)
      : USER.portfolio;

    const signature = `\n\nBest regards,\n${candidateName}\n${candidatePhone} · ${candidateEmail}` +
      (candidateLocation ? ` · ${candidateLocation}` : '');

    const contactBlock = `\n\n📇 Contact\n` +
      `Email:    ${candidateEmail}\n` +
      (candidatePhone ? `Phone:    ${candidatePhone}\n` : '') +
      `LinkedIn: ${candidateLinkedin}\n` +
      `GitHub:   ${candidateGithub}\n` +
      `Portfolio:${candidatePortfolio}`;

    const resumeLine = resumeUrl ? `\n\n📄 Resume (PDF): ${resumeUrl}` : `\n\n📄 My resume is attached to this email.`;

    let emailData = { subject: `Application for ${job.title}`, body: '' };
    try {
      const jdText = `${job.title} at ${job.company}\n${job.description || ''}`;
      emailData = await generateApplicationEmail(job.title, job.company, jdText, activeResumeProfile);
    } catch {}

    if (!emailData.body || emailData.body.length < 100) {
      emailData = {
        subject: `Application for ${job.title} — ${candidateName.split(' ').slice(-1)[0]}`,
        body: `Hi ${job.company} Hiring Team,

I'm ${candidateName}, a full-stack engineer based in ${candidateLocation}. I'm writing to express my interest in the ${job.title} role at ${job.company}. My experience building production-ready applications aligns well with your needs.${resumeLine}${contactBlock}${signature}`,
      };
    } else {
      emailData.body = `${emailData.body.trim()}${resumeLine}${contactBlock}${signature}`;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    let pdfBuffer = null;
    let pdfFilename = null;
    const resumeSourceUrl = resumeUrl || activeResumeId;
    if (resumeSourceUrl) {
      try {
        const pdfUrl = resumeUrl || (await getResumeCloudinaryUrl(resumeSourceUrl, run.userId));
        if (pdfUrl) {
          const pdfRes = await fetch(pdfUrl, { signal: AbortSignal.timeout(15000) });
          if (pdfRes.ok) {
            pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
            pdfFilename = `${candidateName.replace(/\s+/g, '_')}_Resume.pdf`;
          }
        }
      } catch (err) {
        addRunLog(runId, 'Attachment', `Could not fetch PDF: ${err.message}`, 'warning');
      }
    }

    const htmlBody = emailData.body.replace(/\n/g, '<br>');

    await transporter.sendMail({
      from: `"${candidateName}" <${smtpUser}>`,
      to: emails.join(', '),
      subject: emailData.subject.trim(),
      text: emailData.body.trim(),
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${htmlBody}</div>`,
      attachments: pdfBuffer ? [{
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }] : [],
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const savedJob = {
      id: uuid(), title: job.title, company: job.company, role: job.title,
      location: job.location, salary: job.salary || 'Competitive', url: job.url,
      description: job.description, status: 'applied', source: 'auto-apply',
      appliedEmail: emails[0], userId: run.userId,
      dateApplied: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      emailContext: { subject: emailData.subject.trim(), bodyText: emailData.body.trim(), sentAt: new Date().toISOString() },
      resumeContext: { resumeUrl },
    };
    await saveJob(savedJob, run.userId);

    updateRunJob(runId, job.id, { status: 'applied', appliedAt: new Date().toISOString(), appliedEmail: emails[0], processed: true });
    incRunStat(runId, 'applied');
    addRunLog(runId, 'Applied', `✅ ${job.title} @ ${job.company} → ${emails[0]}`, 'success');

  } catch (err) {
    console.error(`[Auto-Apply Process] ${job.title}: ${err.message}`);
    updateRunJob(runId, job.id, { status: 'failed', error: err.message, processed: true });
    incRunStat(runId, 'failed');
    addRunLog(runId, 'Failed', `${job.title}: ${err.message}`, 'error');
  }
}
