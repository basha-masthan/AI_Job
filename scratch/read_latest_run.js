const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'autopilot-runs.json');
if (!fs.existsSync(file)) {
  console.log('File does not exist');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
const runs = data.runs || [];
if (runs.length === 0) {
  console.log('No runs found');
  process.exit(0);
}

const latest = runs[runs.length - 1];
console.log('=== LATEST RUN KEYS ===');
console.log(Object.keys(latest));

console.log('Jobs in latest:', latest.jobs ? latest.jobs.length : 0);
if (latest.jobs) {
  console.log('First job:', latest.jobs[0]);
}

console.log('Logs count:', latest.logs ? latest.logs.length : 0);
if (latest.logs && latest.logs.length > 0) {
  console.log('First 5 logs:');
  latest.logs.slice(0, 5).forEach((log, idx) => {
    console.log(`${idx}: [${log.timestamp}] [${log.type}] ${log.title}: ${log.message}`);
  });
}
