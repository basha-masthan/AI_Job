import fs from 'fs';
import os from 'os';
import path from 'path';

let _fsWritable = null;

export function isFsWritable() {
  if (_fsWritable !== null) return _fsWritable;
  try {
    const tmp = path.join(os.tmpdir(), `fbt_write_${Date.now()}`);
    fs.writeFileSync(tmp, 'test');
    fs.unlinkSync(tmp);
    _fsWritable = true;
  } catch { _fsWritable = false; }
  return _fsWritable;
}

export function safeWriteFileSync(filePath, data) {
  if (!isFsWritable()) return false;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, data);
    return true;
  } catch {
    return false;
  }
}

export function safeReadFileSync(filePath, fallback = '') {
  if (!isFsWritable()) return fallback;
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return fallback;
  }
}

export function safeEnsureFile(filePath, defaultContent = '') {
  if (!isFsWritable()) return;
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, defaultContent);
    }
  } catch {}
}
