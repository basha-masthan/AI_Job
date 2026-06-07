import { NextResponse } from 'next/server';
import { callMcpTool, getAllPerformance, MCP_SERVERS, getMcpPerformance } from '@/lib/mcp-bridge';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mcpName = searchParams.get('mcp');

  if (mcpName) {
    if (!MCP_SERVERS.includes(mcpName)) {
      return NextResponse.json({ error: 'Unknown MCP', available: MCP_SERVERS }, { status: 400 });
    }
    const perf = getMcpPerformance(mcpName);
    return NextResponse.json(perf || { error: 'No data yet' });
  }

  return NextResponse.json({
    mcps: MCP_SERVERS,
    allPerformance: getAllPerformance()
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { mcp, tool, arguments: args } = body;

    if (!mcp || !tool) {
      return NextResponse.json({ error: 'mcp and tool are required' }, { status: 400 });
    }

    if (!MCP_SERVERS.includes(mcp)) {
      return NextResponse.json({ error: 'Unknown MCP', available: MCP_SERVERS }, { status: 400 });
    }

    const result = await callMcpTool(mcp, tool, args || {});
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
