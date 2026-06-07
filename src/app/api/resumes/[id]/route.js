import { NextResponse } from 'next/server';
import { getResumeById, deleteResume, updateResume } from '@/lib/store';

export async function GET(request, { params }) {
  try {
    const resume = getResumeById(params.id);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    return NextResponse.json({ success: true, resume });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { fileName } = await request.json();
    if (!fileName || fileName.trim().length === 0) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }
    
    const resume = getResumeById(params.id);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    
    const updated = await updateResume(params.id, { fileName: fileName.trim() });
    return NextResponse.json({ success: true, resume: updated });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await deleteResume(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
