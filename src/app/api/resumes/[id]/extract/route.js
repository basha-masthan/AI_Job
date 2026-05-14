import { NextResponse } from 'next/server';
import { getResumeById, saveResume } from '@/lib/store';
import { extractProfileFromResumeText } from '@/lib/ai';
import { getSession } from '@/lib/auth';

import pdfParse from 'pdf-parse-new';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const resume = getResumeById(params.id, session.email);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    
    if (resume.source !== 'manual-upload') {
      return NextResponse.json({ error: 'Only manual uploads can be re-extracted' }, { status: 400 });
    }
    if (!resume.cloudinaryUrl) {
      return NextResponse.json({ error: 'No file URL found for this resume' }, { status: 400 });
    }

    // Fetch the file from Cloudinary
    const fileRes = await fetch(resume.cloudinaryUrl);
    if (!fileRes.ok) throw new Error(`Failed to fetch file: ${fileRes.status}`);

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    let rawText = '';

    if (resume.fileType === 'application/pdf') {
      const pdfData = await pdfParse(buffer);
      rawText = pdfData.text;
    } else if (resume.fileType === 'text/plain') {
      rawText = buffer.toString('utf-8');
    } else {
      rawText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    }

    if (rawText.trim().length < 30) {
      return NextResponse.json({ error: 'Could not extract readable text from the file. Try uploading a text-based PDF.' }, { status: 422 });
    }

    const extractedProfile = await extractProfileFromResumeText(rawText);

    const updated = saveResume({
      ...resume,
      extractedProfile,
      profileExtracted: true,
      data: extractedProfile,
    }, session.email);

    return NextResponse.json({ success: true, resume: updated, profile: extractedProfile });
  } catch (err) {
    console.error('Re-extract error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
