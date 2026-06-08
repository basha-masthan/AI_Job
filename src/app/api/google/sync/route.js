import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByEmail, saveUser } from '@/lib/users';
import { getGoogleOAuthClient } from '@/lib/google';
import { google } from 'googleapis';
import { getAllJobs, saveJob } from '@/lib/store';
import { v4 as uuid } from 'uuid';
import { processEmailForJobUpdates } from '@/lib/nylas'; // Reuse AI parsing logic

// Helper to extract email body from Gmail message payload
function getBody(message) {
  const payload = message.payload;
  if (!payload) return message.snippet || '';

  let body = '';
  
  function parsePart(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString();
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      // Basic HTML to text (removes tags, keeps links)
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

  body = parsePart(payload);
  return body || message.snippet || '';
}

// Helper to get subject from headers
function getHeader(headers, name) {
  const header = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserByEmail(session.email);
    if (!user || !user.googleRefreshToken) {
      return NextResponse.json({ error: 'Google not connected' }, { status: 400 });
    }

    const oauth2Client = getGoogleOAuthClient();
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
      expiry_date: user.googleExpiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch emails
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'job OR interview OR application OR rejected OR shortlisted OR Wellfound OR LinkedIn OR Indeed',
      maxResults: 30
    });

    const messages = res.data.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({ success: true, message: 'No emails found matching criteria.', newJobs: [] });
    }

    const existingJobs = await getAllJobs(session.email);
    const newOrUpdatedJobs = [];
    const debugInfo = [];

    // Process top 15 to be more thorough
    const messagesToProcess = messages.slice(0, 15);

    for (let i = 0; i < messagesToProcess.length; i++) {
      const msgRef = messagesToProcess[i];
      // Minimal delay to avoid hitting rate limits too hard
      if (i > 0) await new Promise(r => setTimeout(r, 500));
      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: msgRef.id,
          format: 'full'
        });

        const msgData = msgRes.data;
        const subject = getHeader(msgData.payload.headers, 'subject');
        const from = getHeader(msgData.payload.headers, 'from');
        const body = getBody(msgData);

        debugInfo.push({ subject, from, snippet: msgData.snippet });

        // Build a nylas-like message object to pass to the existing AI logic
        const nylasFormatMsg = {
           subject: subject,
           body: body,
           snippet: msgData.snippet,
           date: msgData.internalDate ? parseInt(msgData.internalDate) / 1000 : Date.now() / 1000
        };

        const update = await processEmailForJobUpdates(nylasFormatMsg, existingJobs);
        
        if (update && update.isJobRelated && update.company && update.role) {
          const existing = existingJobs.find(j => 
            j.company.toLowerCase() === update.company.toLowerCase() &&
            (j.role.toLowerCase() === update.role.toLowerCase() || update.role.toLowerCase().includes('applicant'))
          );

          if (existing) {
            // Update status if it changed
            let changed = false;
            if (existing.status.toLowerCase() !== update.status.toLowerCase()) {
              existing.status = update.status;
              changed = true;
            }
            
            // Fill in missing details if we found them now
            if (!existing.location && update.location) { existing.location = update.location; changed = true; }
            if (!existing.salary && update.salary) { existing.salary = update.salary; changed = true; }
            if ((!existing.url || existing.url === '') && update.jobUrl) { existing.url = update.jobUrl; changed = true; }
            
            if (changed) {
              existing.lastUpdated = new Date().toISOString();
              if (update.notes) {
                existing.notes = (existing.notes || '') + `\nUpdate [${new Date().toLocaleDateString()}]: ${update.notes}`;
              }
              await saveJob(existing, session.email);
              newOrUpdatedJobs.push(existing);
            }
          } else {
            const newJob = {
              id: uuid(),
              company: update.company,
              role: update.role,
              status: update.status || 'Applied',
              location: update.location || '',
              salary: update.salary || '',
              type: update.type || 'Full-time',
              url: update.jobUrl || '',
              dateApplied: new Date(nylasFormatMsg.date * 1000).toISOString().split('T')[0],
              notes: update.notes || `Auto-detected from Google Email: "${nylasFormatMsg.subject}"`,
              source: 'google-email-sync',
            };
            await saveJob(newJob, session.email);
            newOrUpdatedJobs.push(newJob);
            existingJobs.push(newJob);
          }
        }
      } catch (e) {
        console.error('Google Message Fetch Error:', e);
      }
    }

    user.lastGoogleSyncTime = new Date().toISOString();
    
    // Check if tokens were refreshed by the client and save them
    const currentCreds = oauth2Client.credentials;
    if (currentCreds.access_token !== user.googleAccessToken) {
         user.googleAccessToken = currentCreds.access_token;
         user.googleExpiryDate = currentCreds.expiry_date;
         if (currentCreds.refresh_token) user.googleRefreshToken = currentCreds.refresh_token;
    }

    await saveUser(user);

    return NextResponse.json({ 
      success: true, 
      message: `Synced ${newOrUpdatedJobs.length} job updates from Gmail.`,
      jobs: newOrUpdatedJobs,
      debugCount: messagesToProcess.length,
      debugInfo: debugInfo
    });

  } catch (err) {
    console.error('Google Sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
