import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const m = line.match(/^([^=#][^=]*)=(.*)/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});

const key = process.env.OPENROUTER_API_KEY_1;
const models = ['qwen/qwen3-8b:free', 'meta-llama/llama-3.1-8b-instruct:free', 'microsoft/phi-4-reasoning-plus:free'];

const sampleText = `We are hiring a Full Stack Developer at TechCorp Hyderabad.
Skills: React, Node.js, MongoDB. Experience: 2-4 years.
Send your resume to careers@techcorp.in
Location: Hyderabad. Salary: 8-12 LPA.`;

for (const model of models) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: `Extract job info as JSON from this text:\n${sampleText}\n\nReturn: {"company":"...","role":"...","email":"...","location":"...","confidence":0.9}`
        }],
        response_format: { type: 'json_object' },
        max_tokens: 150,
        temperature: 0.1
      })
    });
    const d = await res.json();
    const content = d.choices?.[0]?.message?.content;
    console.log(`\n✅ ${model} (${res.status}):`);
    console.log(content || d.error?.message || JSON.stringify(d).slice(0, 200));
  } catch(e) {
    console.log(`\n❌ ${model}: ${e.message}`);
  }
}
