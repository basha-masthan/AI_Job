import fs from 'fs';
import path from 'path';

export function getStoragePath(filename) {
  const isVercel = process.env.VERCEL === '1' || process.env.NOW_BUILDER === '1';
  const targetDir = isVercel ? '/tmp/data' : path.join(process.cwd(), 'data');
  const sourceDir = path.join(process.cwd(), 'data');

  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (e) {
      console.error('Failed to create target directory:', e.message);
    }
  }

  const targetPath = path.join(targetDir, filename);

  // If on Vercel, copy packaged seed JSON file to target /tmp/data directory if missing
  if (isVercel && !fs.existsSync(targetPath)) {
    const sourcePath = path.join(sourceDir, filename);
    if (fs.existsSync(sourcePath)) {
      try {
        fs.copyFileSync(sourcePath, targetPath);
      } catch (e) {
        console.error(`Failed to copy seed file: ${filename}`, e.message);
      }
    }
  }

  return targetPath;
}

const SETTINGS_PATH = getStoragePath('settings.json');

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading settings.json:', e.message);
  }
  return {};
}

export function getApiKey(keyName) {
  const settings = readSettings();
  const fromSettings = settings.apiKeys?.[keyName];
  if (fromSettings && fromSettings !== '') return fromSettings;
  const val = process.env[keyName] || '';
  if (val) return val;
  if (keyName === 'TAVILY_API_KEY') {
    return process.env['TAVILY_API_KEY_1'] || process.env['TAVILY_API_KEY_2'] || '';
  }
  if (keyName === 'HUNTER_API_KEY') {
    return process.env['HUNTER_API_KEY_1'] || process.env['HUNTER_API_KEY_2'] || '';
  }
  return '';
}

export function getTavilyKeys() {
  const keys = [];
  for (let i = 1; i <= 2; i++) {
    const key = getApiKey(`TAVILY_API_KEY_${i}`);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    const singleKey = getApiKey('TAVILY_API_KEY');
    if (singleKey) keys.push(singleKey);
  }
  return keys.length > 0 ? keys : [''];
}

export function getGroqKeys() {
  const keys = [];
  for (let i = 1; i <= 3; i++) {
    const key = getApiKey(`GROQ_API_KEY_${i}`);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    const singleKey = getApiKey('GROQ_API_KEY');
    if (singleKey) keys.push(singleKey);
  }
  return keys.length > 0 ? keys : [''];
}

export function getOpenRouterKeys() {
  const keys = [];
  for (let i = 1; i <= 2; i++) {
    const key = getApiKey(`OPENROUTER_API_KEY_${i}`);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    const singleKey = getApiKey('OPENROUTER_API_KEY');
    if (singleKey) keys.push(singleKey);
  }
  return keys.length > 0 ? keys : [''];
}

export function getMistralKeys() {
  const keys = [];
  for (let i = 1; i <= 3; i++) {
    const key = getApiKey(`MISTRAL_API_KEY_${i}`);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    const singleKey = getApiKey('MISTRAL_API_KEY');
    if (singleKey) keys.push(singleKey);
  }
  return keys.length > 0 ? keys : [''];
}

export function getCohereKeys() {
  const keys = [];
  for (let i = 1; i <= 3; i++) {
    const key = getApiKey(`COHERE_API_KEY_${i}`);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    const singleKey = getApiKey('COHERE_API_KEY');
    if (singleKey) keys.push(singleKey);
  }
  return keys.length > 0 ? keys : [''];
}

export function getHunterKeys() {
  const keys = [];
  for (let i = 1; i <= 3; i++) {
    const key = getApiKey(`HUNTER_API_KEY_${i}`);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    const singleKey = getApiKey('HUNTER_API_KEY');
    if (singleKey) keys.push(singleKey);
  }
  return keys.length > 0 ? keys : [''];
}

export function getCoresignalKey() {
  return process.env.CORESIGNAL_API_KEY || 'f9PsqgV7xBBB0zkrR1oDuNCn2BSUORuZ';
}

export function getOpenAIKeys() {
  const keys = [];
  for (let i = 1; i <= 2; i++) {
    const key = getApiKey(`OPENAI_API_KEY_${i}`);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    const singleKey = getApiKey('OPENAI_API_KEY');
    if (singleKey) keys.push(singleKey);
  }
  return keys.length > 0 ? keys : [''];
}

export function getSerperKey() {
  return getApiKey('SERPER_API_KEY') || 'dda58ce4c8a6238a447510f8536ad4581f200731';
}

export function getOcrSpaceKey() {
  return getApiKey('OCR_SPACE_API_KEY') || '';
}

export function getAffindaKeys() {
  const keys = [];
  for (let i = 1; i <= 2; i++) {
    const key = getApiKey(`AFFINDA_API_KEY_${i}`);
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) {
    const singleKey = getApiKey('AFFINDA_API_KEY');
    if (singleKey) keys.push(singleKey);
  }
  return keys.length > 0 ? keys : [''];
}

export function getSetting(keyName, defaultValue = '') {
  const settings = readSettings();
  return settings[keyName] ?? defaultValue;
}

export function invalidateSettingsCache() {}
