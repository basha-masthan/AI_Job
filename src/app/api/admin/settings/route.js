import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getSession } from '@/lib/auth';
import { invalidateSettingsCache, getStoragePath } from '@/lib/config';

const SETTINGS_FILE = getStoragePath('settings.json');

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { activeAIProvider: 'openrouter', apiKeys: {} };
    const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { activeAIProvider: 'openrouter', apiKeys: {} };
  }
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  invalidateSettingsCache();
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.email !== 'admin@fbt.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ success: true, settings: readSettings() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getSession();
    if (!session || session.email !== 'admin@fbt.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const currentSettings = readSettings();
    
    const newSettings = {
      ...currentSettings,
      ...body
    };

    writeSettings(newSettings);
    return NextResponse.json({ success: true, settings: newSettings });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
