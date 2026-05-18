import { NextResponse } from 'next/server';
import { getAllJobs, saveJob } from '@/lib/store';
import { getSession } from '@/lib/auth';
import { getUserByEmail } from '@/lib/users';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const user = getUserByEmail(session.email);
    const jobs = getAllJobs(session.email);
    
    return NextResponse.json({ 
      success: true, 
      jobs,
      hasNylas: !!user?.nylasGrantId,
      nylasEmail: user?.nylasEmail,
      hasGoogle: !!user?.googleRefreshToken
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await request.json();
    const job = saveJob(body, session.email);
    return NextResponse.json({ success: true, job });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
