import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(l => { const m = l.match(/^([^=#][^=]*)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); });

const key = process.env.OPENROUTER_API_KEY_1;
const r = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: 'Bearer ' + key } });
const d = await r.json();
const free = (d.data || []).filter(m => m.id.includes(':free')).map(m => m.id);
console.log('Available :free models on your account:\n', free.join('\n'));
