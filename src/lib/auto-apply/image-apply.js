import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuid } from 'uuid';
import nodemailer from 'nodemailer';
import { getOcrSpaceKey } from '@/lib/config';
import { callOpenAI, generateApplicationEmail, generateResumeFromJD, safeJSONParse } from '@/lib/ai';
import { saveJob, getAllResumes, checkAlreadyApplied, checkAlreadyAppliedByEmail } from '@/lib/store';
import { generateAndUploadResumePDF } from '@/lib/pdf-generator';
import { atsScoreJob } from './engine';

const USER = {
  name: 'Masthan Basha Shaik',
  email: 'official4basha@gmail.com',
  phone: '+91 78937 02635',
  location: 'Bangalore, India',
  portfolio: 'https://basha-portfolio.vercel.app/',
  linkedin: 'https://www.linkedin.com/in/masthan-basha-ms/',
  github: 'https://github.com/basha-masthan',
};

const dataDir = path.join(process.cwd(), 'data');
const progressFile = path.join(dataDir, 'auto-apply-picture.json');
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
    if (!fs.existsSync(progressFile)) {
      fs.writeFileSync(progressFile, JSON.stringify({ active: false, steps: [], logs: [], result: null }));
    }
  } catch {}
}

function readProgress() {
  ensureFile();
  try {
    if (isFsWritable()) return JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
  } catch {}
  return { active: false, steps: [], logs: [], result: null };
}

function writeProgress(p) {
  if (!isFsWritable()) return;
  try { fs.writeFileSync(progressFile, JSON.stringify(p, null, 2)); } catch {}
}

function appendLog(progress, title, message, type = 'info') {
  const log = { title, message, type, time: new Date().toISOString() };
  progress.logs.unshift(log);
  if (progress.logs.length > 50) progress.logs = progress.logs.slice(0, 50);
  writeProgress(progress);
}

function setStep(progress, stepId, status, message = '') {
  const step = progress.steps.find(s => s.id === stepId);
  if (step) { step.status = status; step.message = message; writeProgress(progress); }
}

async function extractAndParse(base64Image, mimeType) {
  let text = '';

  const ocrKey = getOcrSpaceKey();
  if (ocrKey) {
    try {
      const fd = new URLSearchParams();
      fd.append('apikey', ocrKey); fd.append('language', 'eng');
      fd.append('isOverlayRequired', 'false'); fd.append('scale', 'true');
      fd.append('OCREngine', '2');
      fd.append('base64Image', `data:${mimeType};base64,${base64Image}`);
      const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd.toString(), signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const d = await res.json();
        const t = d.ParsedResults?.[0]?.ParsedText;
        if (t && t.trim().length > 20) text = t.trim();
      }
    } catch {}
  }

  if (!text) {
    try {
      const prompt = `Extract ALL text from this job posting screenshot exactly as shown — the job title, company name, any email addresses, location, and any other visible text. Return only the extracted text, no commentary.`;
      const result = await callOpenAI([
        { role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ]}
      ], 1500);
      text = result.trim();
    } catch {}
  }

  if (!text || text.length < 20) throw new Error('Could not read this image. Try a clearer screenshot.');

  const system = `You are a job posting parser. Extract ONLY what is visible in the text. Return raw JSON.`;
  const user = `Extract from this text:\n\n${text.substring(0, 4000)}\n\nReturn JSON:\n{"title":"job title","company":"company name","email":"visible email address if any, else empty","location":"location if mentioned, else empty","description":"detailed job description, requirements, and company info visible in the text"}`;

  try {
    const result = await callOpenAI([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], 600);
    const parsed = safeJSONParse(result, null);
    if (parsed && parsed.title) {
      if (!parsed.description) parsed.description = text;
      return parsed;
    }
  } catch {}

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const title = lines.find(l => l.match(/developer|engineer|designer|manager|analyst|architect|programmer/i)) || lines[0] || 'Unknown Role';
  const atMatch = text.match(/at\s+([A-Z][a-zA-Z0-9\s.&]{1,40})/i);
  const company = atMatch ? atMatch[1].trim() : '';
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';
  const loc = text.match(/(Remote|Hybrid|Bangalore|Hyderabad|Mumbai|Delhi|Chennai|Pune|Gurgaon|NCR|India|United States|USA|Singapore|London|Toronto|Vancouver|San Francisco|New York)[^\n,]{0,40}/i);
  return { title: title.substring(0, 200), company: company.substring(0, 100), email, location: loc ? loc[0].trim() : '', description: text };
}

function buildSignature(profile) {
  const name = profile?.name || USER.name;
  const email = profile?.contact?.email || USER.email;
  const phone = profile?.contact?.phone || USER.phone;
  const location = profile?.contact?.location || USER.location;
  const linkedin = profile?.contact?.linkedin
    ? (profile.contact.linkedin.startsWith('http') ? profile.contact.linkedin : `https://${profile.contact.linkedin}`)
    : USER.linkedin;
  const github = profile?.contact?.github
    ? (profile.contact.github.startsWith('http') ? profile.contact.github : `https://${profile.contact.github}`)
    : USER.github;
  const portfolio = profile?.contact?.portfolio
    ? (profile.contact.portfolio.startsWith('http') ? profile.contact.portfolio : `https://${profile.contact.portfolio}`)
    : USER.portfolio;

  return {
    name, email, phone, location, linkedin, github, portfolio,
    block: `\n\n📇 Contact\nEmail: ${email}\n${phone ? `Phone: ${phone}\n` : ''}LinkedIn: ${linkedin}\nGitHub: ${github}\nPortfolio: ${portfolio}`,
    closing: `\n\nBest regards,\n${name}\n${phone} · ${email}${location ? ` · ${location}` : ''}`,
  };
}

export async function getPictureProgress() { return readProgress(); }

export async function resetPictureProgress() {
  const p = { active: false, steps: [], logs: [], result: null };
  writeProgress(p); return p;
}

export async function startPictureApply({ images, userId, resumeId, useAiResume = false }) {
  if (!images || images.length === 0) throw new Error('At least one image is required');

  const results = [];

  for (let idx = 0; idx < images.length; idx++) {
    const { base64, mimeType } = images[idx];

    const progress = {
      active: true,
      currentIndex: idx,
      totalCount: images.length,
      steps: [
        { id: 'start', label: `Started (${idx + 1}/${images.length})`, status: 'active', message: '' },
        { id: 'read', label: 'Reading image', status: 'idle', message: '' },
        { id: 'parse', label: 'Extracting job details', status: 'idle', message: '' },
        { id: 'pdf', label: 'Preparing resume', status: 'idle', message: '' },
        { id: 'mail', label: 'Sending email', status: 'idle', message: '' },
        { id: 'save', label: 'Saving to tracker', status: 'idle', message: '' },
      ],
      logs: [],
      result: null,
    };
    writeProgress(progress);

    try {
      appendLog(progress, `Image ${idx + 1}`, `Processing...`, 'info');
      setStep(progress, 'start', 'success', `Image ${idx + 1} of ${images.length}`);

      setStep(progress, 'read', 'active', 'Reading via OCR + Vision...');
      const job = await extractAndParse(base64, mimeType);
      if (!job.title || job.title === 'Unknown Role') throw new Error('Could not identify a job in this image');
      setStep(progress, 'read', 'success', `Read ${job.title || 'job'} screenshot`);
      appendLog(progress, 'Parsed', `${job.title} @ ${job.company || 'Unknown'}`, 'success');

      const email = job.email;
      if (!email) {
        setStep(progress, 'mail', 'error', 'No email visible in image');
        progress.active = false;
        progress.result = { job, skipped: true, reason: 'No HR email found in image' };
        writeProgress(progress);
        appendLog(progress, 'No Email', 'No email address found in the screenshot', 'error');
        results.push({ index: idx, job, skipped: true, reason: 'No email' });
        continue;
      }

      const emailExists = await checkAlreadyAppliedByEmail(email, userId);
      if (emailExists) {
        setStep(progress, 'mail', 'skipped', `Already sent to ${email}`);
        progress.active = false;
        progress.result = { job, skipped: true, reason: `Previously sent to ${email}` };
        writeProgress(progress);
        appendLog(progress, 'Duplicate', `Already applied to ${email} — skipping`, 'warning');
        results.push({ index: idx, job, skipped: true, reason: 'Duplicate email' });
        continue;
      }

      const roleExists = job.company && await checkAlreadyApplied(job.company, job.title, userId);
      if (roleExists) {
        setStep(progress, 'mail', 'skipped', `Already applied to ${job.title} @ ${job.company}`);
        progress.active = false;
        progress.result = { job, skipped: true, reason: `Duplicate: ${job.title} @ ${job.company}` };
        writeProgress(progress);
        appendLog(progress, 'Duplicate', `Already applied to ${job.title} @ ${job.company} — skipping`, 'warning');
        results.push({ index: idx, job, skipped: true, reason: 'Duplicate role' });
        continue;
      }
      appendLog(progress, 'Email Found', email, 'success');

      const allResumes = getAllResumes(userId);
      let resume = allResumes.find(r => r.id === resumeId) || allResumes[0];
      if (!resume) throw new Error('No resume found. Upload one first.');
      let resumeProfile = resume.data || resume.extractedProfile || resume;

      // Check selected resume score against job description
      let score = await atsScoreJob(job, resumeProfile);
      appendLog(progress, 'ATS Score Check', `Selected resume score: ${score}%`, 'info');

      let resumeUrl = null;
      let selectedBetterFromVault = false;

      if (score < 70) {
        appendLog(progress, 'ATS Score Check', `Score is < 70%. Checking other resumes in vault...`, 'info');
        try {
          let bestScore = score;
          let bestResume = null;

          for (const resItem of allResumes) {
            if (resItem.id === resume.id) continue;
            const resProfile = resItem.data || resItem.extractedProfile || resItem;
            const otherScore = await atsScoreJob(job, resProfile);
            if (otherScore > bestScore) {
              bestScore = otherScore;
              bestResume = resItem;
            }
          }

          if (bestScore >= 70 && bestResume) {
            resume = bestResume;
            resumeProfile = bestResume.data || bestResume.extractedProfile || bestResume;
            score = bestScore;
            resumeUrl = bestResume.cloudinaryUrl || null;
            selectedBetterFromVault = true;
            appendLog(progress, 'ATS Match Success', `Found better resume in vault: "${bestResume.fileName || bestResume.name}" (${score}%)`, 'success');
          }
        } catch (err) {
          console.error('[Picture Apply Scan Resumes Error]', err.message);
        }
      }

      setStep(progress, 'pdf', 'active', (useAiResume && score < 70) ? 'Generating AI-tailored resume...' : 'Using best matching resume...');
      if (useAiResume && score < 70) {
        try {
          const jdText = `${job.title} at ${job.company}\n${(job.description || job.title)}`;
          const newResume = await generateResumeFromJD(jdText, resumeProfile);
          if (newResume) {
            const pdfData = await generateAndUploadResumePDF(newResume, `picture_${uuid()}`);
            resumeUrl = pdfData?.url || null;
          }
        } catch (err) {
          console.error('[Picture Apply Tailoring Failed]', err.message);
        }
      }
      if (!resumeUrl && resume.cloudinaryUrl) resumeUrl = resume.cloudinaryUrl;
      setStep(progress, 'pdf', resumeUrl ? 'success' : 'skipped', resumeUrl ? 'Resume ready' : 'Using original');
      appendLog(progress, 'Resume', resumeUrl ? 'PDF ready' : 'Using original', resumeUrl ? 'success' : 'warning');

      // Dynamic Location Selection
      let targetLocation = 'Hyderabad, India';
      const postTextForLoc = `${job.location || ''} ${job.title || ''} ${job.company || ''} ${job.description || ''}`.toLowerCase();
      if (postTextForLoc.includes('bangalore') || postTextForLoc.includes('bengaluru')) {
        targetLocation = 'Bangalore, India';
      } else if (postTextForLoc.includes('chennai')) {
        targetLocation = 'Chennai, India';
      } else if (postTextForLoc.includes('hyderabad')) {
        targetLocation = 'Hyderabad, India';
      }

      const candidateProfileCopy = {
        ...resumeProfile,
        contact: {
          ...(resumeProfile.contact || {}),
          location: targetLocation
        }
      };

      const sig = buildSignature(candidateProfileCopy);

      let subject = `Application for ${job.title}${job.company ? ` — ${sig.name.split(' ').slice(-1)[0]}` : ''}`;
      let bodyText = '';

      try {
        const jdText = `${job.title} at ${job.company}\n${(job.description || job.title)}`;
        const emailData = await generateApplicationEmail(job.title, job.company || 'Hiring Team', jdText, candidateProfileCopy);
        if (emailData && emailData.body) {
          subject = emailData.subject || subject;
          bodyText = emailData.body;
        }
      } catch (err) {
        console.error('[Picture Apply AI Email Generation Failed]', err.message);
      }

      if (!bodyText) {
        bodyText = `Hi ${job.company || 'Hiring'} Team,\n\nI'm ${sig.name}, a software engineer based in ${sig.location}. I'm writing to express my interest in the ${job.title} role. My experience building production-ready applications aligns well with your needs.\n\nI've attached my resume for your review and would welcome the opportunity to discuss how my skills can contribute to your team.`;
      }

      const resumeLine = resumeUrl ? `\n\n📄 Resume (PDF): ${resumeUrl}` : '';
      const body = `${bodyText.trim()}${resumeLine}${sig.block}${sig.closing}`;

      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpUser || !smtpPass) {
        setStep(progress, 'mail', 'error', 'SMTP not configured');
        progress.active = false;
        progress.result = { job, skipped: true, reason: 'SMTP not configured' };
        writeProgress(progress);
        appendLog(progress, 'SMTP', 'SMTP credentials not configured', 'error');
        results.push({ index: idx, job, skipped: true, reason: 'SMTP' });
        continue;
      }

      let pdfBuffer = null;
      if (resumeUrl) {
        try {
          const r = await fetch(resumeUrl, { signal: AbortSignal.timeout(15000) });
          if (r.ok) pdfBuffer = Buffer.from(await r.arrayBuffer());
        } catch {}
      }

      setStep(progress, 'mail', 'active', `Sending to ${email}...`);
      const transporter = nodemailer.createTransport({
        host: smtpHost, port: smtpPort, secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const trackingId = uuid();
      const trackingPixelUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/track/${trackingId}`;

      const htmlBody = `${body.replace(/\n/g, '<br>')}<br><br><img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />`;

      await transporter.sendMail({
        from: `"${sig.name}" <${smtpUser}>`,
        to: email,
        subject,
        text: body,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${htmlBody}</div>`,
        attachments: pdfBuffer ? [{ filename: `${sig.name.replace(/\s+/g, '_')}_Resume.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : [],
      });
      setStep(progress, 'mail', 'success', `Sent to ${email}`);
      appendLog(progress, 'Email Sent', `Application sent to ${email}`, 'success');

      setStep(progress, 'save', 'active', 'Saving to tracker...');
      const savedJob = {
        id: trackingId, title: job.title, company: job.company, role: job.title,
        location: job.location || 'Remote', salary: 'Competitive', url: '',
        description: '', status: 'applied', source: 'picture-apply',
        appliedEmail: email, userId,
        dateApplied: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        emailContext: { subject, bodyText: body, sentAt: new Date().toISOString() },
        resumeContext: { resumeUrl },
      };
      await saveJob(savedJob, userId);
      setStep(progress, 'save', 'success', 'Saved');
      appendLog(progress, 'Saved', `Job saved to tracker`, 'success');

      progress.active = false;
      progress.result = { job, applied: true, email, savedJobId: trackingId };
      writeProgress(progress);
      appendLog(progress, 'Applied', `✅ ${job.title} @ ${job.company || 'Company'} -> ${email}`, 'success');

      results.push({ index: idx, job, applied: true, email });

    } catch (err) {
      console.error(`[Picture Apply ${idx}]`, err.message);
      progress.active = false;
      progress.result = { error: err.message };
      writeProgress(progress);
      appendLog(progress, 'Error', err.message, 'error');
      results.push({ index: idx, error: err.message });
    }
  }

  return { results, total: images.length, applied: results.filter(r => r.applied).length, failed: results.filter(r => r.error).length };
}
