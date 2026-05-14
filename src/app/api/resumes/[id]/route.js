import { NextResponse } from 'next/server';
import { getResumeById, deleteResume } from '@/lib/store';

export async function GET(request, { params }) {
  try {
    const resume = getResumeById(params.id);
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    return NextResponse.json({ success: true, resume });
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
