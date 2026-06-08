import { NextResponse } from 'next/server';
import { getNylasClient, processEmailForJobUpdates } from '@/lib/nylas';
import { getAllJobs, writeIndex, JOBS_INDEX } from '@/lib/store';
import { getSession } from '@/lib/auth';
import { getUserByEmail } from '@/lib/users';

/**
 * POST /api/nylas/sync
 * Manually pull recent emails from Nylas and auto-update job statuses.
 * This is a reliable fallback if the webhook isn't configured / reachable.
 */
export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserByEmail(session.email);
    if (!user?.nylasGrantId) {
      return NextResponse.json(
        { error: 'No email account connected. Please connect via Settings.' },
        { status: 400 }
      );
    }

    const nylas = getNylasClient();

    // Fetch the last 20 emails from the user's inbox
    const messagesResponse = await nylas.messages.list({
      identifier: user.nylasGrantId,
      queryParams: {
        limit: 20,
        in: ['inbox'],
      },
    });

    const messages = messagesResponse.data || [];
    console.log(`Nylas Sync: Fetched ${messages.length} messages for ${user.email}`);

    const userJobs = await getAllJobs(session.email);
    const updates = [];

    for (const message of messages) {
      try {
        const update = await processEmailForJobUpdates(message, userJobs);

        if (update && update.isJobRelated && update.company && update.role) {
          // Match by company name (case-insensitive) and role
          const existing = userJobs.find(j => 
            j.company.toLowerCase() === update.company.toLowerCase() &&
            (j.role.toLowerCase() === update.role.toLowerCase() || update.role.toLowerCase().includes('applicant'))
          );

          if (existing) {
            let changed = false;
            if (existing.status.toLowerCase() !== update.status.toLowerCase()) {
              existing.status = update.status;
              changed = true;
            }
            
            // Fill in missing details
            if (!existing.location && update.location) { existing.location = update.location; changed = true; }
            if (!existing.salary && update.salary) { existing.salary = update.salary; changed = true; }
            if ((!existing.url || existing.url === '') && update.jobUrl) { existing.url = update.jobUrl; changed = true; }
            
            if (changed) {
              existing.lastUpdated = new Date().toISOString();
              if (update.notes) {
                existing.notes = (existing.notes || '') + `\nUpdate [${new Date().toLocaleDateString()}]: ${update.notes}`;
              }
              await saveJob(existing, session.email);
              updates.push(existing);
            }
          } else {
            // Create new job
            const newJob = {
              id: uuid(),
              company: update.company,
              role: update.role,
              status: update.status || 'Applied',
              location: update.location || '',
              salary: update.salary || '',
              type: update.type || 'Full-time',
              url: update.jobUrl || '',
              dateApplied: new Date(message.date * 1000).toISOString().split('T')[0],
              notes: update.notes || `Auto-detected from Nylas Email: "${message.subject}"`,
              source: 'nylas-email-sync',
            };
            await saveJob(newJob, session.email);
            updates.push(newJob);
            userJobs.push(newJob);
          }
        }
      } catch (msgErr) {
        console.warn(`Skipping message due to error:`, msgErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      emailsScanned: messages.length,
      jobsUpdated: updates.length,
      updates,
    });
  } catch (err) {
    console.error('Nylas Sync Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
