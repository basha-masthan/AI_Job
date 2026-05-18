import fs from 'fs';
import { getStoragePath } from '@/lib/config';
import { v4 as uuid } from 'uuid';

const CHATS_FILE = getStoragePath('brain-chats.json');

function ensureChatsFile() {
  if (!fs.existsSync(CHATS_FILE)) {
    fs.writeFileSync(CHATS_FILE, JSON.stringify([]));
  }
}

export function getUserChats(userId) {
  ensureChatsFile();
  try {
    const all = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf-8'));
    return all.filter(c => c.userId === userId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch (e) {
    console.error('Error reading brain-chats.json:', e);
    return [];
  }
}

export function getChatById(id, userId) {
  const all = getUserChats(userId);
  return all.find(c => c.id === id);
}

export function saveChatSession(session) {
  ensureChatsFile();
  try {
    const all = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf-8'));
    const index = all.findIndex(c => c.id === session.id);
    
    session.updatedAt = new Date().toISOString();
    if (!session.createdAt) session.createdAt = new Date().toISOString();

    if (index !== -1) {
      all[index] = session;
    } else {
      all.push(session);
    }
    
    fs.writeFileSync(CHATS_FILE, JSON.stringify(all, null, 2));
    return session;
  } catch (e) {
    console.error('Error saving chat session:', e);
    return session;
  }
}

export function deleteChatSession(id, userId) {
  ensureChatsFile();
  try {
    const all = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf-8'));
    const filtered = all.filter(c => !(c.id === id && c.userId === userId));
    fs.writeFileSync(CHATS_FILE, JSON.stringify(filtered, null, 2));
    return true;
  } catch (e) {
    console.error('Error deleting chat session:', e);
    return false;
  }
}
