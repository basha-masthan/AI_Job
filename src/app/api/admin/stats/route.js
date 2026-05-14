import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';

// Note: In production with a real DB, you'd query the DB directly.
// Here we are reading the local JSON stores.
const DATA_DIR = path.join(process.cwd(), 'data');

function safeReadJson(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
    return [];
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.email !== 'admin@fbt.com') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const users = safeReadJson('users.json');
    const resumes = safeReadJson('resumes.json');
    const jobs = safeReadJson('jobs.json');

    const stats = {
      totalUsers: users.length,
      verifiedUsers: users.filter(u => u.verified).length,
      nylasConnected: users.filter(u => !!u.nylasGrantId).length,
      
      totalResumes: resumes.length,
      aiGeneratedResumes: resumes.filter(r => r.source === 'ai-generated').length,
      
      totalJobs: jobs.length,
      jobsApplied: jobs.filter(j => j.status === 'applied' || j.status === 'Applied').length,
      jobsInterview: jobs.filter(j => j.status === 'interview' || j.status === 'Interview').length,
      jobsOffer: jobs.filter(j => j.status === 'offer' || j.status === 'Offer').length,
    };

    // Remove passwords from users before sending to frontend
    const sanitizedUsers = users.map(u => {
      const { password, ...safeUser } = u;
      return safeUser;
    });

    return NextResponse.json({ success: true, stats, users: sanitizedUsers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
