import { NextResponse } from 'next/server';
import { getAllResumes } from '@/lib/store';
import { matchResumesWithJD, matchJobsWithResume } from '@/lib/ai';
import { getSession } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { jobDescription, bulk = false } = await request.json();
    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
    }

    const allResumes = getAllResumes(session.email).filter(r => r.data || r.extractedProfile);
    if (allResumes.length === 0) {
      return NextResponse.json({ success: true, matches: [] });
    }

    if (bulk) {
      // Logic for matching one resume against many jobs
      const primaryResume = allResumes[0]; // Use the most recent or primary resume
      const matches = await matchJobsWithResume(primaryResume.data || primaryResume.extractedProfile, jobDescription);
      return NextResponse.json({ success: true, matches });
    }

    const matches = await matchResumesWithJD(jobDescription, allResumes);
    
    // Merge the AI results with the actual resume metadata
    const results = matches.map(m => {
      const resume = allResumes.find(r => r.id === m.id);
      return {
        ...m,
        fileName: resume?.fileName || 'Untitled',
        jobTitle: resume?.jobTitle || 'AI Generated',
        createdAt: resume?.createdAt,
      };
    }).sort((a, b) => b.score - a.score);

    return NextResponse.json({ success: true, matches: results });
  } catch (err) {
    console.error('Match resumes error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
