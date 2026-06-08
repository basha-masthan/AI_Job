import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByEmail, saveUser } from '@/lib/users';
import { getGoogleOAuthClient } from '@/lib/google';
import { google } from 'googleapis';
import { getAllJobs, saveJob } from '@/lib/store';
import { extractJobUpdateFromEmail } from '@/lib/ai';
import { v4 as uuid } from 'uuid';

function getBody(message) {
  const payload = message.payload;
  if (!payload) return message.snippet || '';

  function parsePart(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString();
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      let html = Buffer.from(part.body.data, 'base64').toString();
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        const found = parsePart(subPart);
        if (found) return found;
      }
    }
    return null;
  }

  return parsePart(payload) || message.snippet || '';
}

function getHeader(headers, name) {
  const header = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUserByEmail(session.email);
  if (!user || !user.googleRefreshToken) {
    return NextResponse.json({ error: 'Google not connected. Go to Job Tracker to connect.' }, { status: 400 });
  }

  const oauth2Client = getGoogleOAuthClient();
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.googleExpiryDate,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'job OR application OR interview OR rejected OR shortlisted OR "thank you for applying" OR "application received" OR Indeed OR LinkedIn OR Naukri OR Wellfound',
      maxResults: 25,
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No matching emails found.', updates: [] });
    }

    const existingJobs = await getAllJobs(session.email);
    const updates = [];

    for (let i = 0; i < messages.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 300));
      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me', id: messages[i].id, format: 'full',
        });

        const msgData = msgRes.data;
        const subject = getHeader(msgData.payload.headers, 'subject');
        const from = getHeader(msgData.payload.headers, 'from');
        const body = getBody(msgData);

        const update = await extractJobUpdateFromEmail(subject, body, existingJobs);
        if (!update || !update.isJobRelated) continue;

        const matchedJob = existingJobs.find(j =>
          j.company?.toLowerCase() === update.company?.toLowerCase() &&
          (j.title?.toLowerCase() === update.role?.toLowerCase() ||
           j.title?.toLowerCase().includes(update.role?.toLowerCase().split(' ').slice(0, 2).join(' ')) ||
           j.role?.toLowerCase() === update.role?.toLowerCase())
        );

        if (matchedJob) {
          const changed = update.status && matchedJob.status?.toLowerCase() !== update.status.toLowerCase();
          if (changed) {
            matchedJob.status = update.status;
            matchedJob.lastUpdated = new Date().toISOString();
            matchedJob.notes = (matchedJob.notes || '') + `\n[${new Date().toLocaleDateString()}] Email update: ${update.notes || update.status}`;
            await saveJob(matchedJob, session.email);
            updates.push({ id: matchedJob.id, title: matchedJob.title || matchedJob.role, company: matchedJob.company, oldStatus: matchedJob.status, newStatus: update.status, from, subject });
          }
        }
      } catch {}
    }

    user.lastAutoEmailSyncTime = new Date().toISOString();
    await saveUser(user);

    return NextResponse.json({
      success: true,
      synced: messages.length,
      message: `Scanned ${messages.length} emails, found ${updates.length} job updates.`,
      updates,
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('invalid_grant') || msg.includes('Invalid Credentials')) {
      return NextResponse.json({ error: 'Google token expired. Reconnect in Job Tracker.', reauth: true }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
