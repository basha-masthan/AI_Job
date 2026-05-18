import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserProgress, saveProgress, removeProgress } from '@/lib/training';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const progress = getUserProgress(session.email);
  return NextResponse.json({ progress });
}

export async function POST(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { roleId, level, sectionId, moduleId, completed } = await request.json();
  if (!roleId || !level || !sectionId || !moduleId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let entry;
  if (completed === false) {
    entry = removeProgress(session.email, roleId, level, sectionId, moduleId);
  } else {
    entry = saveProgress(session.email, roleId, level, sectionId, moduleId);
  }

  return NextResponse.json({ success: true, progress: entry });
}
