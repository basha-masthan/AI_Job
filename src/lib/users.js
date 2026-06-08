import fs from 'fs';
import path from 'path';
import { getStoragePath } from '@/lib/config';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

const USERS_FILE = getStoragePath('users.json');

function ensureDataDir() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
}

function readUsersFromFile() {
  ensureDataDir();
  try {
    const content = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeUsersToFile(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function isMongoAvailable() {
  return !!process.env.MONGODB_URI;
}

async function toMongoUser(user) {
  if (!user) return null;
  return {
    email: user.email,
    name: user.name,
    password: user.password,
    verified: user.verified || false,
    verificationCode: user.verificationCode,
    profile: user.profile || {},
    preferences: user.preferences || {},
    createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
    updatedAt: new Date(),
  };
}

function fromMongoUser(doc) {
  if (!doc) return null;
  return {
    id: doc._id?.toString(),
    email: doc.email,
    name: doc.name,
    password: doc.password,
    verified: doc.verified,
    verificationCode: doc.verificationCode,
    profile: doc.profile || {},
    preferences: doc.preferences || {},
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

export async function getAllUsers() {
  if (isMongoAvailable()) {
    try {
      await dbConnect();
      const users = await User.find({}).sort({ createdAt: -1 }).lean();
      return users.map(fromMongoUser);
    } catch (err) {
      console.error('[users] MongoDB getAllUsers failed, falling back to JSON:', err.message);
    }
  }
  return readUsersFromFile();
}

export async function saveUser(user) {
  if (isMongoAvailable()) {
    try {
      await dbConnect();
      const mongoUser = await toMongoUser(user);
      
      await User.findOneAndUpdate(
        { email: user.email.toLowerCase() },
        { $set: mongoUser },
        { upsert: true, new: true }
      );
      
      return true;
    } catch (err) {
      console.error('[users] MongoDB saveUser failed, falling back to JSON:', err.message);
    }
  }
  
  const users = readUsersFromFile();
  const index = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (index !== -1) {
    users[index] = { ...users[index], ...user };
  } else {
    users.push(user);
  }
  writeUsersToFile(users);
  return true;
}

export async function getUserByEmail(email) {
  if (isMongoAvailable()) {
    try {
      await dbConnect();
      const user = await User.findOne({ email: email.toLowerCase() }).lean();
      if (user) return fromMongoUser(user);
    } catch (err) {
      console.error('[users] MongoDB getUserByEmail failed, falling back to JSON:', err.message);
    }
  }
  
  const users = readUsersFromFile();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function updateUser(email, updates) {
  if (isMongoAvailable()) {
    try {
      await dbConnect();
      await User.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $set: { ...updates, updatedAt: new Date() } }
      );
      return true;
    } catch (err) {
      console.error('[users] MongoDB updateUser failed, falling back to JSON:', err.message);
    }
  }
  
  const users = readUsersFromFile();
  const index = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    writeUsersToFile(users);
    return true;
  }
  return false;
}
