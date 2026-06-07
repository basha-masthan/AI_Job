import { createMcpServer, tool, startStdioServer } from '../shared/mcp-utils.js';
import nodemailer from 'nodemailer';

const MCP_NAME = 'email-sender-mcp';

function sanitizeEmailText(text) {
  if (!text || typeof text !== 'string') return '';
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*\n?/i, '');
  t = t.replace(/\n?\s*```\s*$/, '');
  if (/^\s*\{/.test(t)) {
    try { const parsed = JSON.parse(t); if (parsed.body) return parsed.body; if (parsed.text) return parsed.text; } catch {}
  }
  t = t.replace(/^["']body["']\s*:\s*["']/i, '');
  t = t.replace(/["']\s*$/i, '');
  t = t.replace(/^\{.*?"body"\s*:\s*"/s, '');
  t = t.replace(/"\s*\}\s*$/s, '');
  t = t.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  return t.trim();
}

async function sendApplication(args) {
  const { to, subject, body, resumeUrl, companyName, jobTitle, userProfile } = args;

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    return {
      success: false,
      error: 'SMTP credentials not configured',
      _reward: -10
    };
  }

  const user = userProfile || {
    name: 'Candidate',
    email: smtpUser,
    phone: '',
    portfolio: '',
    linkedin: '',
    github: ''
  };

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });

  let emailSubject = sanitizeEmailText(subject);
  if (!emailSubject || emailSubject.length < 5) emailSubject = `Application for ${jobTitle || 'Position'}`;

  let emailBody = sanitizeEmailText(body);

  const linkBlock = resumeUrl
    ? `\n\n📄 Tailored Resume (PDF): ${resumeUrl}`
    : '\n\n📄 My tailored resume is attached to this email.';

  if (resumeUrl && !emailBody.includes(resumeUrl) && !emailBody.includes('{{RESUME_LINK}}')) {
    emailBody += linkBlock;
  }

  if (user.portfolio && !emailBody.includes(user.portfolio)) {
    emailBody += `\n\nPortfolio: ${user.portfolio}`;
  }
  if (user.linkedin && !emailBody.includes(user.linkedin)) {
    emailBody += `\nLinkedIn: ${user.linkedin}`;
  }
  if (user.github && !emailBody.includes(user.github)) {
    emailBody += `\nGitHub: ${user.github}`;
  }

  let attachments = [];
  let attachmentBuffer = null;

  if (resumeUrl) {
    try {
      const res = await fetch(resumeUrl, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        attachmentBuffer = Buffer.from(await res.arrayBuffer());
        attachments = [{
          filename: `Resume_${(user.name || 'Candidate').replace(/\s+/g, '_')}.pdf`,
          content: attachmentBuffer
        }];
      }
    } catch {}
  }

  const mailOptions = {
    from: `"${user.name}" <${smtpUser}>`,
    to,
    subject: emailSubject.trim(),
    text: emailBody.trim()
  };

  if (attachments.length > 0) {
    mailOptions.attachments = attachments;
  }

  try {
    const info = await transporter.sendMail(mailOptions);

    const result = {
      success: true,
      messageId: info.messageId,
      to,
      subject: emailSubject,
      company: companyName,
      jobTitle,
      resumeAttached: attachmentBuffer !== null,
      resumeUrl: resumeUrl || null,
      sentAt: new Date().toISOString(),
      _reward: 10
    };

    recordSendResult(result);
    return result;
  } catch (err) {
    const errorMsg = err.message || '';

    if (/ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|temporarily/i.test(errorMsg)) {
      return {
        success: false,
        error: 'Transient network error — retry recommended',
        transient: true,
        _reward: -3
      };
    }

    if (/authentication|535|credentials/i.test(errorMsg)) {
      return {
        success: false,
        error: 'SMTP authentication failed',
        _reward: -10
      };
    }

    if (/ECONREFUSED|ETIMEDOUT/i.test(errorMsg)) {
      return {
        success: false,
        error: 'SMTP server unreachable',
        _reward: -8
      };
    }

    return {
      success: false,
      error: errorMsg,
      _reward: -5
    };
  }
}

const sendHistory = [];

function recordSendResult(result) {
  sendHistory.push({
    ...result,
    timestamp: new Date().toISOString()
  });
  if (sendHistory.length > 100) sendHistory.shift();
}

async function trackDelivery(args) {
  const { messageId } = args;

  const record = sendHistory.find(r => r.messageId === messageId);
  if (!record) {
    return {
      messageId,
      found: false,
      reason: 'Message not tracked — only tracks sends from this session',
      _reward: 0
    };
  }

  return {
    messageId,
    found: true,
    sent: record.sentAt,
    success: record.success,
    company: record.company,
    jobTitle: record.jobTitle,
    to: record.to
  };
}

async function getSendStats() {
  if (sendHistory.length === 0) {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      successRate: 0,
      transientFailures: 0,
      avgConfidence: 0
    };
  }

  const successful = sendHistory.filter(r => r.success);
  const failed = sendHistory.filter(r => !r.success);
  const transient = sendHistory.filter(r => r.transient);

  return {
    total: sendHistory.length,
    successful: successful.length,
    failed: failed.length,
    successRate: parseFloat((successful.length / sendHistory.length * 100).toFixed(1)),
    transientFailures: transient.length,
    recentSends: sendHistory.slice(-10).map(r => ({
      to: r.to,
      company: r.company,
      success: r.success,
      timestamp: r.timestamp
    }))
  };
}

const server = createMcpServer(MCP_NAME, { warmupThreshold: 15, learningRate: 0.1 });

server.registerTool(tool('send_application', 'Send a job application email with optional resume attachment and Cloudinary link.', {
  type: 'object',
  properties: {
    to: { type: 'string', description: 'Recipient email address' },
    subject: { type: 'string', description: 'Email subject line' },
    body: { type: 'string', description: 'Email body text (plain text)' },
    resumeUrl: { type: 'string', description: 'Cloudinary URL for the resume PDF' },
    companyName: { type: 'string', description: 'Company name for tracking' },
    jobTitle: { type: 'string', description: 'Job title for tracking' },
    userProfile: {
      type: 'object',
      description: 'User profile with name, email, phone, portfolio, linkedin, github'
    }
  },
  required: ['to', 'subject', 'body']
}, sendApplication));

server.registerTool(tool('track_delivery', 'Track delivery status of a previously sent application email.', {
  type: 'object',
  properties: {
    messageId: { type: 'string', description: 'Message ID from send_application response' }
  },
  required: ['messageId']
}, trackDelivery));

server.registerTool(tool('get_send_stats', 'Get sending statistics for this session.', {
  type: 'object',
  properties: {}
}, getSendStats));

startStdioServer(server);
