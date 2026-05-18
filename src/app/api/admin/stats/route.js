import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';

// Note: In production with a real DB, you'd query the DB directly.
// Here we are reading the local JSON stores.
const DATA_DIR = path.join(process.cwd(), 'data');

function safeReadJson(filename, fallback = []) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
    return fallback;
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.email !== 'admin@fbt.com') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const users = safeReadJson('users.json');
    const resumes = safeReadJson('resumes.json');
    const jobs = safeReadJson('jobs.json');

    const stats = {
      totalUsers: users.length,
      verifiedUsers: users.filter(u => u.verified).length,
      nylasConnected: users.filter(u => !!u.nylasGrantId).length,
      
      totalResumes: resumes.length,
      aiGeneratedResumes: resumes.filter(r => r.source === 'ai-generated').length,
      
      totalJobs: jobs.length,
      jobsApplied: jobs.filter(j => j.status === 'applied' || j.status === 'Applied').length,
      jobsInterview: jobs.filter(j => j.status === 'interview' || j.status === 'Interview').length,
      jobsOffer: jobs.filter(j => j.status === 'offer' || j.status === 'Offer').length,
    };

    const settings = safeReadJson('settings.json', { activeAIProvider: 'huggingface' });

    const activeKeys = {
      'OPENROUTER_API_KEY_1': !!(settings.apiKeys?.['OPENROUTER_API_KEY_1'] || process.env['OPENROUTER_API_KEY_1'] || settings.apiKeys?.['OPENROUTER_API_KEY'] || process.env['OPENROUTER_API_KEY']),
      'OPENROUTER_API_KEY_2': !!(settings.apiKeys?.['OPENROUTER_API_KEY_2'] || process.env['OPENROUTER_API_KEY_2']),
      'GROQ_API_KEY_1': !!(settings.apiKeys?.['GROQ_API_KEY_1'] || process.env['GROQ_API_KEY_1'] || settings.apiKeys?.['GROQ_API_KEY'] || process.env['GROQ_API_KEY']),
      'GROQ_API_KEY_2': !!(settings.apiKeys?.['GROQ_API_KEY_2'] || process.env['GROQ_API_KEY_2']),
      'GROQ_API_KEY_3': !!(settings.apiKeys?.['GROQ_API_KEY_3'] || process.env['GROQ_API_KEY_3']),
      'CEREBRAS_API_KEY': !!(settings.apiKeys?.['CEREBRAS_API_KEY'] || process.env['CEREBRAS_API_KEY']),
      'GEMINI_API_KEY': !!(settings.apiKeys?.['GEMINI_API_KEY'] || process.env['GEMINI_API_KEY']),
      'HF_TOKEN': !!(settings.apiKeys?.['HF_TOKEN'] || process.env['HF_TOKEN']),
      'TAVILY_API_KEY_1': !!(settings.apiKeys?.['TAVILY_API_KEY_1'] || process.env['TAVILY_API_KEY_1'] || settings.apiKeys?.['TAVILY_API_KEY'] || process.env['TAVILY_API_KEY']),
      'TAVILY_API_KEY_2': !!(settings.apiKeys?.['TAVILY_API_KEY_2'] || process.env['TAVILY_API_KEY_2']),
    };

    // Remove passwords from users and attach resume counts before sending to frontend
    const sanitizedUsers = users.map(u => {
      const { password, ...safeUser } = u;
      safeUser.resumeCount = resumes.filter(r => r.userId === u.email).length;
      return safeUser;
    });

    return NextResponse.json({ success: true, stats, users: sanitizedUsers, settings, activeKeys });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
