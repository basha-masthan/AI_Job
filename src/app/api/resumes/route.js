import { NextResponse } from 'next/server';
import { getAllResumes } from '@/lib/store';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const resumes = getAllResumes(session.email);
    return NextResponse.json({ success: true, resumes });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
