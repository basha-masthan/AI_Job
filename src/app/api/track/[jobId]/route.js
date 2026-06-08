import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { safeWriteFileSync, safeReadFileSync, isFsWritable } from '@/lib/fs-safe';

const jobsFile = path.join(process.cwd(), 'data', 'jobs.json');
const runsFile = path.join(process.cwd(), 'data', 'auto-apply-runs.json');
const oldRunsFile = path.join(process.cwd(), 'data', 'autopilot-runs.json');

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req, { params }) {
  const jobId = params.jobId;

  try {
    // Update job tracking status in jobs.json
    if (isFsWritable() && fs.existsSync(jobsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'));
        const job = data.jobs?.find(j => j.id === jobId || j.trackingId === jobId);
        if (job) {
          if (!job.emailOpened) {
            job.emailOpened = true;
            job.emailOpenedAt = new Date().toISOString();
            job.emailOpenCount = 1;
            console.log(`[EMAIL TRACKER] Job ${jobId} email OPENED by recruiter at ${job.company}`);
          } else {
            job.emailOpenCount = (job.emailOpenCount || 1) + 1;
            job.emailLastOpenedAt = new Date().toISOString();
            console.log(`[EMAIL TRACKER] Job ${jobId} email re-opened (total ${job.emailOpenCount}x) at ${job.company}`);
          }
          safeWriteFileSync(jobsFile, JSON.stringify(data, null, 2));
        }
      } catch {}
    }

    // Also update in auto-apply-runs.json (new) and autopilot-runs.json (legacy)
    for (const rf of [runsFile, oldRunsFile]) {
      try {
        if (fs.existsSync(rf)) {
          const runsData = JSON.parse(fs.readFileSync(rf, 'utf-8'));
          let updated = false;
          for (const run of runsData.runs || []) {
            const jobInRun = run.jobs?.find(j => j.id === jobId || j.trackingId === jobId || j.savedJobId === jobId);
            if (jobInRun) {
              jobInRun.emailOpened = true;
              jobInRun.emailOpenedAt = jobInRun.emailOpenedAt || new Date().toISOString();
              jobInRun.emailOpenCount = (jobInRun.emailOpenCount || 0) + 1;
              updated = true;
              break;
            }
          }
          if (updated) fs.writeFileSync(rf, JSON.stringify(runsData, null, 2));
        }
      } catch {}
    }
  } catch (err) {
    console.error('[EMAIL TRACKER] Error:', err.message);
  }

  // Always return the tracking pixel regardless of errors
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
