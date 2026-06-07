import { NextResponse } from 'next/server';
import { generateResumeFromJD } from '@/lib/ai';
import { saveResume } from '@/lib/store';
import { getSession } from '@/lib/auth';
import { generateAndUploadResumePDF } from '@/lib/pdf-generator';
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

    const resumeId = uuid();
    const publicId = `ai_${resumeId}`;

    let cloudinaryUrl = null;
    let cloudinaryPublicId = null;
    let pdfSize = 0;

    try {
      const { cloudinaryResult, pdfBuffer } = await generateAndUploadResumePDF(resumeData, publicId);
      cloudinaryUrl = cloudinaryResult.secure_url;
      cloudinaryPublicId = cloudinaryResult.public_id;
      pdfSize = pdfBuffer.length;
      console.log(`[PDF] Generated ${pdfBuffer.length} byte PDF, uploaded to ${cloudinaryUrl}`);
    } catch (pdfErr) {
      console.error('[PDF] Generation/upload failed, saving resume without PDF:', pdfErr.message);
    }

    const newResume = {
      id: resumeId,
      fileName: `Resume - ${jobTitle || 'New Role'}.pdf`,
      jobTitle: jobTitle || 'Tailored Role',
      jobDescription: jobDescription,
      data: resumeData,
      cloudinaryUrl,
      cloudinaryPublicId,
      fileType: cloudinaryUrl ? 'application/pdf' : null,
      pdfSize,
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
