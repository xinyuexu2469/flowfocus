// Focus Flow API Server
// Backend server to connect to Neon Postgres database

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { pool } from './db.js';
import tasksRoutes from './routes/tasks.js';
import timeSegmentsRoutes from './routes/timeSegments.js';
import projectsRoutes from './routes/projects.js';
import goalsRoutes from './routes/goals.js';
import aiRoutes from './routes/ai.js';
import googleCalendarRoutes from './routes/googleCalendar.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
// Enable CORS for dev frontend with credentials (allow 8080 / 8081 / 8082)
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin or no-origin (e.g., curl/Postman) and the dev frontends
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json()); // Parse JSON request bodies

// Clerk authentication middleware helper
// This extracts userId from Clerk's req.auth and makes it available to routes
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

// Development mode: If no CLERK_SECRET_KEY, use a test user
// WARNING: Only use this for local development!
const DEV_MODE = !CLERK_SECRET_KEY;
let devTestUserId = null; // Will be set on first request

// Helper function to get or create test user in development mode
async function getOrCreateDevTestUser() {
  if (devTestUserId) {
    return devTestUserId;
  }
  
  try {
    // Check if test user exists
    const result = await pool.query(
      "SELECT id FROM public.users WHERE email = 'dev@test.local' LIMIT 1"
    );
    
    if (result.rows.length > 0) {
      devTestUserId = result.rows[0].id;
      return devTestUserId;
    }
    
    // Create test user
    const insertResult = await pool.query(
      `INSERT INTO public.users (email, full_name, created_at, updated_at)
       VALUES ('dev@test.local', 'Development Test User', NOW(), NOW())
       RETURNING id`
    );
    
    devTestUserId = insertResult.rows[0].id;
    console.log(`✅ Created development test user: ${devTestUserId}`);
    return devTestUserId;
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  }
}

if (DEV_MODE) {
  console.warn('⚠️  WARNING: Running in DEVELOPMENT MODE (no Clerk authentication)');
  console.warn('⚠️  This should only be used for local development!');
  console.warn('⚠️  To enable authentication, add CLERK_SECRET_KEY to backend/.env');
}

const requireAuth = CLERK_SECRET_KEY ? ClerkExpressRequireAuth() : null;
const clerkAuth = async (req, res, next) => {
  if (DEV_MODE) {
    // Development mode: Get or create test user
    try {
      const testUserId = await getOrCreateDevTestUser();
      req.userId = testUserId;
      req.auth = { userId: testUserId };
      next();
    } catch (error) {
      console.error('❌ Development mode error:', error);
      res.status(500).json({ error: 'Failed to initialize development user' });
    }
  } else {
    // Production mode: Use Clerk authentication
    requireAuth(req, res, () => {
      req.userId = req.auth?.userId;
      next();
    });
  }
};

// Health check endpoint (with timeout to prevent hanging)
app.get('/api/health', async (req, res) => {
  // Set a timeout for the response
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ 
        status: 'timeout', 
        database: 'connection_timeout',
        message: 'Database connection is taking too long. The database might be idle.'
      });
    }
  }, 5000); // 5 second timeout

  try {
    // Try to query with a shorter timeout
    const queryPromise = pool.query('SELECT NOW()');
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 3000)
    );
    
    const result = await Promise.race([queryPromise, timeoutPromise]);
    clearTimeout(timeout);
    
    if (!res.headersSent) {
      res.json({ 
        status: 'ok', 
        database: 'connected',
        time: result.rows[0].now 
      });
    }
  } catch (error) {
    clearTimeout(timeout);
    if (!res.headersSent) {
      res.status(503).json({ 
        status: 'error', 
        database: 'disconnected',
        error: error.message,
        tip: 'Try running a query in Neon SQL Editor to wake up the database, or use Direct connection instead of Pooler'
      });
    }
  }
});

// Public routes (no authentication required)
app.get('/api/health', async (req, res) => {
  // Health check remains public
});

// Protected API Routes (require Clerk authentication)
app.use('/api/tasks', clerkAuth, tasksRoutes);
app.use('/api/time-segments', clerkAuth, timeSegmentsRoutes);
app.use('/api/projects', clerkAuth, projectsRoutes);
app.use('/api/goals', clerkAuth, goalsRoutes);
app.use('/api/ai', clerkAuth, aiRoutes);
app.use('/api/google-calendar', clerkAuth, googleCalendarRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

