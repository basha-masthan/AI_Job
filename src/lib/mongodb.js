import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'jobhunt';

function getConnectionUri() {
  if (!MONGODB_URI) return '';
  
  if (MONGODB_URI.includes('/?')) return MONGODB_URI;
  if (MONGODB_URI.endsWith('/')) return MONGODB_URI + MONGODB_DB;
  if (MONGODB_URI.endsWith('.net') || MONGODB_URI.endsWith('.mongodb.net')) return MONGODB_URI + '/' + MONGODB_DB;
  
  return MONGODB_URI;
}

if (!MONGODB_URI) {
  console.warn('[MongoDB] MONGODB_URI is not defined in the environment. Database connections will fail.');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const uri = getConnectionUri();

    if (!uri) {
      throw new Error('Please define the MONGODB_URI environment variable');
    }

    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      console.log('[MongoDB] Successfully connected to database.');
      return mongoose;
    }).catch(err => {
      console.error('[MongoDB] Connection error:', err.message);
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
