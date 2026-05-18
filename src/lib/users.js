import fs from 'fs';
import path from 'path';

import { getStoragePath } from '@/lib/config';

const USERS_FILE = getStoragePath('users.json');

export function ensureDataDir() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
}

export function getAllUsers() {
  ensureDataDir();
  try {
    const content = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

export function saveUser(user) {
  const users = getAllUsers();
  const index = users.findIndex(u => u.email === user.email);
  if (index !== -1) {
    users[index] = { ...users[index], ...user };
  } else {
    users.push(user);
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function getUserByEmail(email) {
  const users = getAllUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}
