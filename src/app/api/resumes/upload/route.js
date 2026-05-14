import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { saveResume, getResumeById } from '@/lib/store';
import { extractProfileFromResumeText } from '@/lib/ai';
import { getSession } from '@/lib/auth';

import pdfParse from 'pdf-parse-new';

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const formData = await request.formData();
    const file = formData.get('file');
    const notes = formData.get('notes') || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name;
    const fileType = file.type;
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: 'Only PDF, DOC, DOCX, or TXT files are allowed' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 });
    }

    const buffer = Buffer.from(bytes);
    const id = uuidv4();
    const publicId = `manual_${id}`;

    // 1. Upload to Cloudinary
    let cloudinaryUrl = null;
    let cloudinaryPublicId = publicId;
    try {
      const upload = await uploadToCloudinary(buffer, publicId, 'raw');
      cloudinaryUrl = upload.secure_url;
      cloudinaryPublicId = upload.public_id;
    } catch (err) {
      console.error('Cloudinary upload failed:', err);
      return NextResponse.json({ error: 'File upload failed: ' + err.message }, { status: 500 });
    }

    // 2. Save metadata to index immediately
    const record = saveResume({
      id,
      fileName,
      cloudinaryUrl,
      cloudinaryPublicId,
      fileType,
      notes,
      source: 'manual-upload',
      isFavorite: false,
      extractedProfile: null,
      profileExtracted: false,
      createdAt: new Date().toISOString(),
    }, session.email);

    // 3. Extract profile text from the file (async, non-blocking for response)
    extractProfileInBackground(id, buffer, fileType, fileName, session.email);

    return NextResponse.json({
      success: true,
      resume: record,
      message: 'Uploaded! Profile is being extracted in the background.',
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function extractProfileInBackground(id, buffer, fileType, fileName, userId) {
  try {
    let rawText = '';

    if (fileType === 'application/pdf') {
      const pdfData = await pdfParse(buffer);
      rawText = pdfData.text;
    } else if (fileType === 'text/plain') {
      rawText = buffer.toString('utf-8');
    } else {
      rawText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    }

    if (rawText.trim().length < 50) {
      console.warn(`[Profile Extract] Too little text from ${fileName}, skipping AI extraction`);
      return;
    }

    console.log(`[Profile Extract] Extracting profile from ${fileName} (${rawText.length} chars)...`);
    const extractedProfile = await extractProfileFromResumeText(rawText);

    const resume = getResumeById(id, userId);
    if (resume) {
      saveResume({
        ...resume,
        extractedProfile,
        profileExtracted: true,
        data: extractedProfile,
      }, userId);
    }

    console.log(`[Profile Extract] ✓ Profile extracted for ${fileName}: ${extractedProfile.name}`);
  } catch (err) {
    console.error(`[Profile Extract] Failed for ${fileName}:`, err.message);
  }
}
