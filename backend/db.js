// Database connection pool for Neon Postgres

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('Please set DATABASE_URL in .env file');
  process.exit(1);
}

// Create connection pool
export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('neon.tech') ? {
    rejectUnauthorized: false // Required for Neon
  } : undefined,
  max: 10, // Reduced pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000, // Increased to 30 seconds
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Test connection on startup (with retry and better error handling)
let retryCount = 0;
const maxRetries = 5;

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully at', res.rows[0].now);
  } catch (err) {
    retryCount++;
    if (retryCount < maxRetries) {
      console.log(`⏳ Retrying connection (${retryCount}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      return testConnection();
    } else {
      console.error('❌ Database connection error after', maxRetries, 'retries:', err.message);
      console.error('💡 Tip: The database might be idle. Try running a query in Neon SQL Editor first.');
      console.error('💡 Tip: Check if the connection string points to the correct branch (development vs production)');
    }
  }
}

// Start connection test after a short delay to allow pool to initialize
setTimeout(() => {
  testConnection().catch(console.error);
}, 1000);

// Helper function to execute queries
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50) + '...', duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error', { text, error: error.message });
    throw error;
  }
}

export default pool;

