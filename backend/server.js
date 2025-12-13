import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { pool } from './db.js';

import tasksRoutes from './routes/tasks.js';
import timeSegmentsRoutes from './routes/timeSegments.js';
import projectsRoutes from './routes/projects.js';
import goalsRoutes from './routes/goals.js';
import aiRoutes from './routes/ai.js';
import googleCalendarRoutes from './routes/googleCalendar.js';
// 如需 auth 路由可自行启用：
// import authRoutes from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const allowDevNoAuth = process.env.ALLOW_DEV_NO_AUTH === '1';
const DEV_USER_ID = process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001';

const baseClerkAuth = process.env.CLERK_SECRET_KEY && !allowDevNoAuth
  ? ClerkExpressRequireAuth()
  : null;

// 如果未配置 Clerk 密钥，则放行（便于本地/开发调试）
const clerkAuth = process.env.CLERK_SECRET_KEY && !allowDevNoAuth
  ? ((req, res, next) => {
      return baseClerkAuth(req, res, (err) => {
        if (err) return next(err);
        // 统一注入给各路由使用（不少路由依赖 req.userId）
        req.userId = req.auth?.userId;
        next();
      });
    })
  : ((req, res, next) => {
      // 兼容路由对 req.auth.userId 与 req.userId 的依赖（开发/未接入 Clerk 时）
      req.auth = req.auth || { userId: DEV_USER_ID };
      req.userId = req.userId || DEV_USER_ID;
      next();
    });

async function ensureDevUser() {
  if (!allowDevNoAuth) return;
  try {
    await pool.query(
      `INSERT INTO public.users (id, email, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [DEV_USER_ID, 'dev@local', 'Dev User']
    );
  } catch (err) {
    // 不阻塞启动；如果 schema 没初始化，这里可能会失败
    console.warn('⚠️  ensureDevUser skipped:', err.message);
  }
}

// 允许的前端来源（本地与 Codespaces 公网域名）
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.VITE_FRONTEND_URL,
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
].filter(Boolean);

function isAllowedCodespacesOrigin(origin) {
  const codespaceName = process.env.CODESPACE_NAME;
  if (!codespaceName) return false;
  // e.g. https://<codespaceName>-8080.app.github.dev
  const re = new RegExp(`^https://${codespaceName}-\\d+\\.app\\.github\\.dev$`);
  return re.test(origin);
}

// CORS 配置
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // 允许无 Origin（如 curl/健康检查）
      if (allowedOrigins.includes(origin) || isAllowedCodespacesOrigin(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
// 预检
app.options('*', cors());

app.use(express.json());

// 根路径说明
app.get('/', (req, res) => {
  res.json({
    name: 'FlowFocus API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      tasks: '/api/tasks',
      ai: '/api/ai',
      goals: '/api/goals',
      projects: '/api/projects',
      timeSegments: '/api/time-segments',
      googleCalendar: '/api/google-calendar',
    },
  });
});

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as now');
    res.json({
      status: 'ok',
      database: 'connected',
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error('DB health check error:', err.message);
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: err.message,
    });
  }
});

// 受保护的业务路由
app.use('/api/tasks', clerkAuth, tasksRoutes);
app.use('/api/time-segments', clerkAuth, timeSegmentsRoutes);
app.use('/api/projects', clerkAuth, projectsRoutes);
app.use('/api/goals', clerkAuth, goalsRoutes);
app.use('/api/ai', clerkAuth, aiRoutes);
app.use('/api/google-calendar', clerkAuth, googleCalendarRoutes);
// 如果需要 auth 路由：
// app.use('/api/auth', authRoutes);

// 全局错误处理（含 CORS）
app.use((err, req, res, next) => {
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS blocked', origin: req.headers.origin });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  ensureDevUser();
});