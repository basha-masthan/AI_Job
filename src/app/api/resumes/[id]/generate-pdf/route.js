import { NextResponse } from 'next/server';
import { getResumeById, saveResume } from '@/lib/store';
import { getSession } from '@/lib/auth';
import { generateAndUploadResumePDF } from '@/lib/pdf-generator';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    const resume = getResumeById(id, session.email);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    if (!resume.data) {
      return NextResponse.json({ error: 'Resume has no data to render' }, { status: 400 });
    }

    if (resume.cloudinaryUrl && resume.fileType === 'application/pdf') {
      return NextResponse.json({ success: true, message: 'PDF already exists', cloudinaryUrl: resume.cloudinaryUrl });
    }

    const publicId = resume.cloudinaryPublicId || `ai_${resume.id}`;
    const { cloudinaryResult, pdfBuffer } = await generateAndUploadResumePDF(resume.data, publicId);

    const updated = saveResume({
      ...resume,
      cloudinaryUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      fileType: 'application/pdf',
      pdfSize: pdfBuffer.length,
      fileName: resume.fileName?.endsWith('.pdf') ? resume.fileName : `${resume.fileName || 'Resume'}.pdf`,
    }, session.email);

    return NextResponse.json({ success: true, cloudinaryUrl: cloudinaryResult.secure_url, resume: updated });
  } catch (err) {
    console.error('Generate PDF error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
