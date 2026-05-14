import { NextResponse } from 'next/server';
import { getAllJobs, writeIndex, ensureDirs, JOBS_INDEX } from '@/lib/store';

/**
 * API for N8N to update job status based on email parsing
 * Expected body: { jobId: "uuid", status: "rejected/interview/offer", note: "Optional text" }
 */
export async function POST(request) {
  try {
    const { jobId, status, note } = await request.json();

    if (!jobId || !status) {
      return NextResponse.json({ error: 'jobId and status are required' }, { status: 400 });
    }

    ensureDirs();
    const jobs = getAllJobs();
    const jobIndex = jobs.findIndex(j => j.id === jobId);

    if (jobIndex === -1) {
      // If jobId not found, maybe try to match by company/title? 
      // For now, let's keep it simple.
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const updatedJob = {
      ...jobs[jobIndex],
      status,
      updatedAt: new Date().toISOString(),
      notes: note ? (jobs[jobIndex].notes ? jobs[jobIndex].notes + '\n' + note : note) : jobs[jobIndex].notes
    };

    jobs[jobIndex] = updatedJob;
    writeIndex(JOBS_INDEX, jobs);

    return NextResponse.json({ success: true, job: updatedJob });
  } catch (err) {
    console.error('N8N update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
