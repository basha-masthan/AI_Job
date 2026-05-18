import { NextResponse } from 'next/server';
import { getRoleLevel } from '@/lib/training';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const roleId = searchParams.get('role');
  const level = searchParams.get('level');

  if (!roleId || !level) {
    return NextResponse.json({ error: 'role and level are required' }, { status: 400 });
  }

  const levelData = getRoleLevel(roleId, level);
  if (!levelData) {
    return NextResponse.json({ error: 'Role or level not found' }, { status: 404 });
  }

  const sections = levelData.sections.map(s => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    modules: s.modules,
  }));

  return NextResponse.json({
    level: { id: level, label: levelData.label, description: levelData.description },
    sections,
  });
}
