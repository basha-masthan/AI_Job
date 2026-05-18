import { NextResponse } from 'next/server';
import { getTrainingData } from '@/lib/training';

export async function GET() {
  const data = getTrainingData();
  const roles = data.roles.map(({ id, name, description, icon }) => ({
    id, name, description, icon,
    levels: Object.entries({ beginner: 'Beginner', mid: 'Intermediate', pro: 'Pro' }).map(([key, label]) => ({
      id: key,
      label,
    })),
  }));
  return NextResponse.json({ roles });
}
