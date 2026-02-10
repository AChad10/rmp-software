import mongoose from 'mongoose';

// MongoDB Atlas is REQUIRED - no local fallback
const MONGODB_URI = process.env.MONGODB_URI;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

export async function connectDatabase(): Promise<void> {
  // Validate MongoDB URI is set
  if (!MONGODB_URI) {
    console.error('[ERROR] MONGODB_URI environment variable is required!');
    console.error('');
    console.error('Please set MONGODB_URI in your .env file:');
    console.error('  MONGODB_URI=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/rmp-payroll');
    console.error('');
    console.error('Get your connection string from MongoDB Atlas:');
    console.error('  1. Go to https://cloud.mongodb.com');
    console.error('  2. Select your cluster → Connect → Drivers');
    console.error('  3. Copy the connection string');
    console.error('');
    throw new Error('MONGODB_URI environment variable is required');
  }

  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log('[OK] MongoDB Atlas connected successfully');
      console.log(`[DB] Database: ${mongoose.connection.name}`);

      // Backfill panNumber for existing trainers missing it
      const trainersCollection = mongoose.connection.collection('trainers');
      const backfillResult = await trainersCollection.updateMany(
        { $or: [{ panNumber: { $exists: false } }, { panNumber: null }, { panNumber: '' }] },
        { $set: { panNumber: 'PLACEHOLDER' } }
      );
      if (backfillResult.modifiedCount > 0) {
        console.log(`[MIGRATION] Backfilled panNumber for ${backfillResult.modifiedCount} trainer(s)`);
      }

      // Set up connection event handlers
      mongoose.connection.on('error', (err) => {
        console.error('[ERROR] MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[WARN] MongoDB disconnected. Attempting to reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('[OK] MongoDB reconnected');
      });

      return;
    } catch (error) {
      retries++;
      console.error(`[ERROR] MongoDB connection attempt ${retries}/${MAX_RETRIES} failed:`, error);

      if (retries >= MAX_RETRIES) {
        console.error('[FATAL] Max retries reached. Could not connect to MongoDB.');
        throw new Error('Failed to connect to MongoDB after maximum retries');
      }

      console.log(`[INFO] Retrying in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('[OK] MongoDB disconnected gracefully');
  } catch (error) {
    console.error('[ERROR] Error disconnecting from MongoDB:', error);
    throw error;
  }
}

// Graceful shutdown handler
export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`\n[SHUTDOWN] ${signal} received. Closing MongoDB connection...`);
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
