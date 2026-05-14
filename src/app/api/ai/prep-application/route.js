import { NextResponse } from 'next/server';
import { generateApplicationToolkit } from '@/lib/ai';
import { getResumeById } from '@/lib/store';

export async function POST(request) {
  try {
    const { jobDescription, resumeId } = await request.json();
    
    if (!jobDescription || !resumeId) {
      return NextResponse.json({ error: 'JD and Resume ID are required' }, { status: 400 });
    }

    const resume = getResumeById(resumeId);
    if (!resume) throw new Error('Resume not found');

    const profile = resume.data || resume.extractedProfile;
    if (!profile) throw new Error('Resume profile not extracted yet');

    const toolkit = await generateApplicationToolkit(jobDescription, profile);
    
    return NextResponse.json({ success: true, toolkit });
  } catch (err) {
    console.error('Prep application error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
