import { NextResponse } from 'next/server';
import { matchResumeToJD } from '@/lib/ai';
import { getAllResumes } from '@/lib/store';

export async function POST(request) {
  try {
    const { jobDescription } = await request.json();

    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
    }

    const resumes = getAllResumes();
    if (resumes.length === 0) {
      return NextResponse.json({ error: 'No resumes found in vault. Generate one first.' }, { status: 404 });
    }

    const matches = await matchResumeToJD(jobDescription, resumes);

    // Merge match data with resume metadata
    const enriched = matches.map(match => {
      const resume = resumes.find(r => r.id === match.id);
      return { ...match, resumeMeta: resume ? { id: resume.id, jobTitle: resume.jobTitle, createdAt: resume.createdAt, name: resume.data?.name } : null };
    });

    return NextResponse.json({ success: true, matches: enriched });
  } catch (err) {
    console.error('Match resume error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
