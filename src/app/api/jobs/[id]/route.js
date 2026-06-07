import { NextResponse } from 'next/server';
import { saveJob, deleteJob, getAllJobs } from '@/lib/store';
import { getSession } from '@/lib/auth';

export async function PATCH(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const updates = await request.json();
    const jobs = getAllJobs(session.email);
    const job = jobs.find(j => j.id === params.id);
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    
    const updated = await saveJob({ ...job, ...updates }, session.email);
    return NextResponse.json({ success: true, job: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    await deleteJob(params.id, session.email);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
