import { NextResponse } from 'next/server';
import { generateResumeFromJD } from '@/lib/ai';
import { saveResume } from '@/lib/store';
import { getSession } from '@/lib/auth';
import { v4 as uuid } from 'uuid';

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { jobDescription, jobTitle, userProfile, isSmartMerge } = await request.json();

    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
    }

    const resumeData = await generateResumeFromJD(jobDescription, userProfile, isSmartMerge);
    
    const newResume = {
      id: uuid(),
      fileName: `Resume - ${jobTitle || 'New Role'}`,
      jobTitle: jobTitle || 'Tailored Role',
      jobDescription: jobDescription,
      data: resumeData,
      source: 'ai-generated',
      isFavorite: false,
      createdAt: new Date().toISOString(),
      profileExtracted: true,
    };

    const saved = saveResume(newResume, session.email);

    return NextResponse.json({ success: true, resume: saved });
  } catch (err) {
    console.error('Generate resume error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
