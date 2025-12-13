import express from 'express';
import { google } from 'googleapis';
import { pool } from '../db.js';

const router = express.Router();

// OAuth2 配置
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/calendar-settings'
);

// 生成授权 URL
router.get('/auth/url', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    prompt: 'consent',
  });
  
  res.json({ url: authUrl });
});

// OAuth 回调处理 - 接收前端发来的授权码
router.post('/auth/callback', async (req, res) => {
  const { code } = req.body;
  const userId = req.auth?.userId; // 从 Clerk 获取

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  try {
    // 用授权码换取 tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // 存储 tokens（加密存储，这里简化）
    await pool.query(`
      INSERT INTO google_calendar_tokens (user_id, access_token, refresh_token, token_expiry, calendar_id, sync_enabled)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        access_token = $2,
        refresh_token = $3,
        token_expiry = $4,
        calendar_id = $5,
        sync_enabled = true,
        updated_at = NOW()
    `, [
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      'primary'
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 检查连接状态
router.get('/auth/status', async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const result = await pool.query(
      'SELECT access_token, token_expiry FROM google_calendar_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }
    
    const token = result.rows[0];
    const isExpired = token.token_expiry ? new Date(token.token_expiry) < new Date() : false;
    
    res.json({ 
      connected: true,
      needsRefresh: isExpired
    });
  } catch (error) {
    // 迁移未执行时，避免把整个前端初始化打崩
    if (error?.code === '42P01' || String(error?.message || '').includes('google_calendar_tokens')) {
      return res.json({ connected: false });
    }
    res.status(500).json({ error: error.message });
  }
});

// 断开连接
router.post('/auth/disconnect', async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // 删除 tokens
    await pool.query(
      'DELETE FROM google_calendar_tokens WHERE user_id = $1',
      [userId]
    );
    
    // 删除所有 Google 同步的事件
    await pool.query(`
      UPDATE time_segments 
      SET deleted_at = NOW()
      WHERE user_id = $1 AND source = 'google'
    `, [userId]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 同步 Google Calendar 事件
router.post('/sync', async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // 1. 获取用户的 tokens
    const tokenResult = await pool.query(
      'SELECT access_token, refresh_token FROM google_calendar_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Not connected to Google Calendar' });
    }
    
    const { access_token, refresh_token } = tokenResult.rows[0];
    
    // 2. 设置认证
    oauth2Client.setCredentials({
      access_token,
      refresh_token,
    });
    
    // 3. 创建 Calendar API 客户端
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // 4. 获取事件（未来 30 天）
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items || [];
    let syncedCount = 0;
    
    // 5. 同步每个事件
    for (const event of events) {
      // 跳过全天事件（可选）
      if (!event.start.dateTime) continue;
      
      // 计算时长（分钟）
      const startTime = new Date(event.start.dateTime);
      const endTime = new Date(event.end.dateTime);
      const duration = Math.round((endTime - startTime) / 60000);
      
      // 插入或更新 time_segment
      await pool.query(`
        INSERT INTO time_segments (
          user_id,
          title,
          description,
          date,
          start_time,
          end_time,
          duration,
          status,
          source,
          google_calendar_event_id,
          read_only,
          task_id,
          "order"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'planned', 'google', $8, true, NULL, 999)
        ON CONFLICT (google_calendar_event_id)
        DO UPDATE SET
          title = $2,
          description = $3,
          start_time = $5,
          end_time = $6,
          duration = $7,
          updated_at = NOW(),
          deleted_at = NULL
      `, [
        userId,
        event.summary || 'Untitled Event',
        event.description || null,
        startTime.toISOString().split('T')[0],
        startTime.toISOString(),
        endTime.toISOString(),
        duration,
        event.id
      ]);
      
      syncedCount++;
    }
    
    // 6. 更新同步时间
    await pool.query(
      'UPDATE google_calendar_tokens SET last_sync = NOW() WHERE user_id = $1',
      [userId]
    );
    
    res.json({ 
      success: true,
      synced: syncedCount,
      message: `Synced ${syncedCount} events from Google Calendar`
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    if (error?.code === '42P01' || String(error?.message || '').includes('google_calendar_tokens')) {
      return res.status(503).json({ error: 'Google Calendar not initialized. Run DB migrations.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// 获取同步状态
router.get('/sync/status', async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const result = await pool.query(
      'SELECT last_sync FROM google_calendar_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({ lastSync: null });
    }
    
    res.json({ lastSync: result.rows[0].last_sync });
  } catch (error) {
    if (error?.code === '42P01' || String(error?.message || '').includes('google_calendar_tokens')) {
      return res.json({ lastSync: null });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;

