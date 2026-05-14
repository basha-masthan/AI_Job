import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByEmail, saveUser } from '@/lib/users';
import { getNylasClient, processEmailForJobUpdates } from '@/lib/nylas';
import { getAllJobs, saveJob } from '@/lib/store';
import { v4 as uuid } from 'uuid';

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = getUserByEmail(session.email);
    if (!user || !user.nylasGrantId) {
      return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
    }

    const nylas = getNylasClient();
    
    // Fetch recent emails - broadened search and increased limit
    const messages = await nylas.messages.list({
      identifier: user.nylasGrantId,
      queryParams: {
        limit: 30,
      }
    });

    if (!messages || !messages.data || messages.data.length === 0) {
      return NextResponse.json({ success: true, message: 'No emails found in your inbox.', newJobs: [] });
    }

    const existingJobs = getAllJobs(session.email);
    const newOrUpdatedJobs = [];
    const debugInfo = [];

    for (const msg of messages.data) {
      debugInfo.push({ subject: msg.subject, from: msg.from?.[0]?.email, snippet: msg.snippet });
      
      try {
        const update = await processEmailForJobUpdates(msg, existingJobs);
        if (update && update.isJobRelated && update.company && update.role) {
          
          const existing = existingJobs.find(j => 
            j.company.toLowerCase() === update.company.toLowerCase()
          );

          if (existing) {
            if (existing.status.toLowerCase() !== update.status.toLowerCase()) {
              const updatedJob = { ...existing, status: update.status, lastUpdated: new Date().toISOString() };
              saveJob(updatedJob, session.email);
              newOrUpdatedJobs.push(updatedJob);
            }
          } else {
            const newJob = {
              id: uuid(),
              company: update.company,
              role: update.role,
              status: update.status || 'Applied',
              url: '',
              dateApplied: new Date(msg.date * 1000).toISOString().split('T')[0],
              notes: `Auto-detected from email: "${msg.subject}"`,
              source: 'email-sync',
            };
            saveJob(newJob, session.email);
            newOrUpdatedJobs.push(newJob);
            existingJobs.push(newJob);
          }
        }
      } catch (e) {
        console.error('Sync error:', e);
      }
    }

    user.lastEmailSyncTime = new Date().toISOString();
    saveUser(user);

    return NextResponse.json({ 
      success: true, 
      message: `Synced ${newOrUpdatedJobs.length} job updates.`,
      jobs: newOrUpdatedJobs,
      debugCount: messages.data.length,
      debugInfo: debugInfo // Returning snippets for debugging
    });

  } catch (err) {
    console.error('Email sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
