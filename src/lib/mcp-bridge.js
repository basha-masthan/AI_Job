import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const DATA_DIR = path.join(process.cwd(), 'data');
const REWARDS_FILE = path.join(DATA_DIR, 'mcp-rewards.json');
const MCP_DIR = path.join(process.cwd(), 'mcp');

export function ensureRewardsFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REWARDS_FILE)) {
    fs.writeFileSync(REWARDS_FILE, JSON.stringify({
      mcpInstances: {},
      globalStats: { totalPositive: 0, totalNegative: 0, totalRewards: 0 },
      lastUpdated: new Date().toISOString()
    }, null, 2));
  }
}

export function getRewardsData() {
  ensureRewardsFile();
  try {
    return JSON.parse(fs.readFileSync(REWARDS_FILE, 'utf-8'));
  } catch {
    return { mcpInstances: {}, globalStats: { totalPositive: 0, totalNegative: 0, totalRewards: 0 } };
  }
}

export function saveRewardsData(data) {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(REWARDS_FILE, JSON.stringify(data, null, 2));
}

export function recordReward(mcpName, actionType, points, metadata = {}) {
  const data = getRewardsData();
  if (!data.mcpInstances[mcpName]) {
    data.mcpInstances[mcpName] = {
      rewards: [],
      stats: { positive: 0, negative: 0, total: 0, avgScore: 0 }
    };
  }

  const instance = data.mcpInstances[mcpName];
  const reward = {
    id: `r_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    actionType,
    points,
    metadata,
    timestamp: new Date().toISOString()
  };

  instance.rewards.push(reward);
  if (instance.rewards.length > 500) instance.rewards = instance.rewards.slice(-500);

  if (points > 0) instance.stats.positive += points;
  else instance.stats.negative += Math.abs(points);
  instance.stats.total += 1;

  const allPoints = instance.rewards.map(r => r.points);
  instance.stats.avgScore = allPoints.reduce((a, b) => a + b, 0) / allPoints.length;

  if (points > 0) data.globalStats.totalPositive += points;
  else data.globalStats.totalNegative += Math.abs(points);
  data.globalStats.totalRewards += 1;

  saveRewardsData(data);
  return reward;
}

export function getMcpPerformance(mcpName) {
  const data = getRewardsData();
  const instance = data.mcpInstances[mcpName];
  if (!instance) return null;

  const recentRewards = instance.rewards.slice(-50);
  const recentAvg = recentRewards.length > 0
    ? recentRewards.reduce((a, b) => a + b.points, 0) / recentRewards.length
    : 0;

  const warmupThreshold = 20;
  const confidence = Math.min(instance.stats.total / warmupThreshold, 1.0);
  const adjustedScore = instance.stats.avgScore * confidence;

  return {
    mcpName,
    totalAttempts: instance.stats.total,
    positivePoints: instance.stats.positive,
    negativePoints: instance.stats.negative,
    avgScore: parseFloat(instance.stats.avgScore.toFixed(3)),
    recentAvg: parseFloat(recentAvg.toFixed(3)),
    confidence: parseFloat(confidence.toFixed(3)),
    adjustedScore: parseFloat(adjustedScore.toFixed(3)),
    isWarmedUp: instance.stats.total >= warmupThreshold,
    recentRewards: recentRewards.slice(-10).map(r => ({
      type: r.actionType,
      points: r.points,
      timestamp: r.timestamp
    }))
  };
}

export function getAllPerformance() {
  const data = getRewardsData();
  const result = {};
  for (const mcpName of Object.keys(data.mcpInstances)) {
    result[mcpName] = getMcpPerformance(mcpName);
  }
  return result;
}

export function launchMcpServer(mcpName) {
  const serverPath = path.join(MCP_DIR, mcpName, 'server.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error(`MCP server not found: ${serverPath}`);
  }

  const child = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_MODE: 'child' }
  });

  return child;
}

export async function callMcpTool(mcpName, toolName, args = {}) {
  return new Promise((resolve, reject) => {
    const child = launchMcpServer(mcpName);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    const id = `call_${Date.now()}`;
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    });

    child.stdin.write(request + '\n');

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`MCP call to ${mcpName}.${toolName} timed out`));
    }, 60000);

    child.stdout.on('data', (chunk) => {
      try {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          const resp = JSON.parse(line);
          if (resp.id === id) {
            clearTimeout(timeout);
            child.kill();
            if (resp.error) reject(new Error(resp.error.message));
            else resolve(resp.result);
          }
        }
      } catch {}
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export const MCP_SERVERS = [
  'job-search-mcp',
  'company-verify-mcp',
  'email-finder-mcp',
  'jd-resume-matcher-mcp',
  'email-sender-mcp',
];

export function getMcpSkillManifest() {
  return {
    name: 'mcp-hub',
    description: 'Self-training AI job-hunting MCP system with 5 specialized agents. Each MCP has its own reinforcement learning trainer that rewards accurate work and penalizes errors.',
    mcps: MCP_SERVERS.map(name => ({
      name,
      tools: getMcpTools(name),
      description: getMcpDescription(name)
    }))
  };
}

function getMcpDescription(name) {
  const descriptions = {
    'job-search-mcp': 'Searches job listings across multiple sources and ranks by relevance to user profile using reinforcement learning.',
    'company-verify-mcp': 'Verifies company legitimacy via domain checks, web presence, and social proof.',
    'email-finder-mcp': 'Discovers and verifies HR/careers/team emails using Hunter.io and pattern matching.',
    'jd-resume-matcher-mcp': 'Scores job descriptions against resumes, generates ATS-optimized resumes when match <80%.',
    'email-sender-mcp': 'Sends job application emails with Cloudinary resume links and tracks delivery.'
  };
  return descriptions[name] || name;
}

function getMcpTools(name) {
  const toolsMap = {
    'job-search-mcp': ['search_jobs', 'check_relevance', 'rank_results'],
    'company-verify-mcp': ['verify_company', 'check_legitimacy', 'get_company_info'],
    'email-finder-mcp': ['find_hr_email', 'find_careers_email', 'verify_email'],
    'jd-resume-matcher-mcp': ['score_match', 'generate_resume', 'identify_gaps'],
    'email-sender-mcp': ['send_application', 'track_delivery', 'get_send_stats']
  };
  return toolsMap[name] || [];
}
