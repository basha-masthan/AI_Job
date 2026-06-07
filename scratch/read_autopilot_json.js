const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'autopilot.json');
if (!fs.existsSync(file)) {
  console.log('File does not exist');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
console.log('=== AUTOPILOT JSON ===');
console.log(data);
