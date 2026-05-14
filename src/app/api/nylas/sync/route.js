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

    const user = getUserByEmail(session.email);
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

    const userJobs = getAllJobs(user.id);
    const allJobs = getAllJobs(); // full list for write-back
    const updates = [];
    let jobsModified = false;

    for (const message of messages) {
      try {
        const update = await processEmailForJobUpdates(message, userJobs);

        if (update && update.isJobRelated && update.company) {
          // Match by company name (case-insensitive)
          const jobIndex = allJobs.findIndex(
            j =>
              j.userId === user.id &&
              j.company?.toLowerCase() === update.company?.toLowerCase()
          );

          if (jobIndex !== -1 && update.status && update.status !== 'none') {
            const prevStatus = allJobs[jobIndex].status;
            if (prevStatus !== update.status) {
              allJobs[jobIndex] = {
                ...allJobs[jobIndex],
                status: update.status,
                updatedAt: new Date().toISOString(),
                notes:
                  (allJobs[jobIndex].notes || '') +
                  `\n[AI Sync ${new Date().toLocaleDateString()}]: ${update.role} — ${update.status}`,
              };
              jobsModified = true;
              updates.push({
                company: update.company,
                role: update.role,
                prevStatus,
                newStatus: update.status,
              });
              console.log(`✅ Synced: ${update.company} → ${update.status}`);
            }
          }
        }
      } catch (msgErr) {
        console.warn(`Skipping message due to error:`, msgErr.message);
      }
    }

    if (jobsModified) {
      writeIndex(JOBS_INDEX, allJobs);
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
