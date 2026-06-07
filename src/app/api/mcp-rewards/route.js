import { NextResponse } from 'next/server';
import { getAllPerformance, getRewardsData } from '@/lib/mcp-bridge';
import { getSession } from '@/lib/auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mcpName = searchParams.get('mcp');

  try {
    const rewardsData = getRewardsData();
    const performance = getAllPerformance();

    return NextResponse.json({
      rewards: rewardsData,
      performance,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
