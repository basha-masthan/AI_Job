import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

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
  await dbConnect();
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  return users.map(fromMongoUser);
}

export async function saveUser(user) {
  await dbConnect();
  await User.findOneAndUpdate(
    { email: user.email.toLowerCase() },
    { $set: { ...user, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
  return true;
}

export async function getUserByEmail(email) {
  await dbConnect();
  const user = await User.findOne({ email: email.toLowerCase() }).lean();
  return fromMongoUser(user);
}

export async function updateUser(email, updates) {
  await dbConnect();
  await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { ...updates, updatedAt: new Date() } }
  );
  return true;
}
