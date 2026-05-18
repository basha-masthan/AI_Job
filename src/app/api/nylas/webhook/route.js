import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getNylasClient, processEmailForJobUpdates } from '@/lib/nylas';
import { getAllJobs, writeIndex, JOBS_INDEX } from '@/lib/store';
import { getAllUsers } from '@/lib/users';
import { notifyN8N } from '@/lib/n8n';
import { getApiKey } from '@/lib/config';

// ─── Webhook Signature Verification ────────────────────────────────────────
function verifyNylasSignature(request, rawBody) {
  const signature = request.headers.get('x-nylas-signature');
  if (!signature) return false;

  const secret = getApiKey('NYLAS_CLIENT_SECRET');
  if (!secret) return false;

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hmac));
}

// ─── Webhook Challenge (GET) ────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');
  if (challenge) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}

// ─── Webhook Event Handler (POST) ──────────────────────────────────────────
export async function POST(request) {
  try {
    const rawBody = await request.text();

    // ✅ Security: Verify HMAC signature from Nylas
    if (!verifyNylasSignature(request, rawBody)) {
      console.warn('Nylas Webhook: Invalid signature — request rejected.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = JSON.parse(rawBody);
    const trigger = data.type; // e.g. 'message.created'
    console.log(`Nylas Webhook received: ${trigger}`);

    if (trigger === 'message.created') {
      const messageData = data.data.object;
      const grantId = data.data.grant_id;

      // ✅ Fix: Resolve the correct user from grantId — never expose all users' jobs
      const allUsers = getAllUsers();
      const matchedUser = allUsers.find(u => u.nylasGrantId === grantId);

      if (!matchedUser) {
        console.warn(`Nylas Webhook: No user found for grantId ${grantId}. Skipping.`);
        return NextResponse.json({ success: true, skipped: 'no_user_for_grant' });
      }

      const nylas = getNylasClient();

      // Fetch full message content from Nylas
      const message = await nylas.messages.find({
        identifier: messageData.id,
        grantId: grantId,
      });

      // ✅ Fix: Scope jobs to the matched user only
      const userJobs = getAllJobs(matchedUser.id);
      const update = await processEmailForJobUpdates(message.data, userJobs);

      if (update && update.isJobRelated) {
        console.log(`AI detected job-related email for ${matchedUser.email}:`, update);

        // Try to match against an existing job by company name
        const allJobs = getAllJobs(); // full list for write-back
        const jobIndex = allJobs.findIndex(
          j =>
            j.userId === matchedUser.id &&
            j.company?.toLowerCase() === update.company?.toLowerCase()
        );

        if (jobIndex !== -1 && update.status && update.status !== 'none') {
          allJobs[jobIndex] = {
            ...allJobs[jobIndex],
            status: update.status,
            updatedAt: new Date().toISOString(),
            notes:
              (allJobs[jobIndex].notes || '') +
              `\n[AI Auto-Update ${new Date().toLocaleDateString()}]: ${update.role} — ${update.status}`,
          };
          writeIndex(JOBS_INDEX, allJobs);
          console.log(`✅ Job updated: ${update.company} → ${update.status}`);

          // ✅ Notify n8n automation pipeline
          await notifyN8N('email.job_update_detected', {
            userId: matchedUser.id,
            email: matchedUser.email,
            company: update.company,
            role: update.role,
            newStatus: update.status,
          });
        } else {
          console.log(`No existing job matched for company: ${update.company}. No update applied.`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Nylas Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
