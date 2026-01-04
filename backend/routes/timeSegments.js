// Time Segments API routes

import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Get all time segments for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const date = req.query.date; // Optional: filter by date (YYYY-MM-DD)
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let sql = `SELECT * FROM time_segments 
               WHERE user_id = $1 AND deleted_at IS NULL`;
    const params = [userId];

    if (date) {
      sql += ` AND date = $2`;
      params.push(date);
    }

    sql += ` ORDER BY date, start_time`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching time segments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get time segments for a specific date
router.get('/by-date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `SELECT * FROM time_segments 
       WHERE user_id = $1 AND date = $2 AND deleted_at IS NULL 
       ORDER BY start_time`,
      [userId, date]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching time segments by date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new time segment
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      task_id,
      start_time,
      end_time,
      date,
      title,
      title_is_custom,
      description,
      notes,
      status,
      order,
      color,
      tags,
      duration,
    } = req.body;

    if (!task_id || !start_time || !end_time || !date || !title) {
      return res.status(400).json({ 
        error: 'task_id, start_time, end_time, date, and title are required' 
      });
    }

    const result = await query(
      `INSERT INTO time_segments (
        task_id, user_id, start_time, end_time, date, title, title_is_custom,
        description, notes, status, "order", color, tags, duration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        task_id,
        userId,
        start_time,
        end_time,
        date,
        title,
        title_is_custom || false,
        description || null,
        notes || null,
        status || 'planned',
        order || 1,
        color || null,
        tags || [],
        duration || null,
      ]
    );

    const newSegment = result.rows[0];
    
    // Recalculate and update task's scheduled_time
    await recalculateTaskScheduledTime(newSegment.task_id);
    
    res.status(201).json(newSegment);
  } catch (error) {
    console.error('Error creating time segment:', error);
    if (error?.code === '23514') {
      if (error?.constraint === 'valid_times') {
        return res.status(400).json({
          error: 'Invalid time range: end_time must be after start_time.',
        });
      }
      if (error?.constraint === 'no_midnight_cross') {
        return res.status(400).json({
          error: 'Invalid time range: a single time segment cannot cross midnight. Split it into two days.',
        });
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// Update a time segment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      updateFields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, userId);

    const result = await query(
      `UPDATE time_segments 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time segment not found or access denied' });
    }

    const updatedSegment = result.rows[0];
    
    // Recalculate and update task's scheduled_time
    await recalculateTaskScheduledTime(updatedSegment.task_id);
    
    res.json(updatedSegment);
  } catch (error) {
    console.error('Error updating time segment:', error);
    if (error?.code === '23514') {
      if (error?.constraint === 'valid_times') {
        return res.status(400).json({
          error: 'Invalid time range: end_time must be after start_time.',
        });
      }
      if (error?.constraint === 'no_midnight_cross') {
        return res.status(400).json({
          error: 'Invalid time range: a single time segment cannot cross midnight. Split it into two days.',
        });
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a time segment (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `UPDATE time_segments 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time segment not found or access denied' });
    }

    // Get task_id before deletion for scheduled_time recalculation
    const segmentResult = await query(
      `SELECT task_id FROM time_segments WHERE id = $1`,
      [id]
    );
    
    if (segmentResult.rows.length > 0) {
      const taskId = segmentResult.rows[0].task_id;
      // Recalculate and update task's scheduled_time
      await recalculateTaskScheduledTime(taskId);
    }
    
    res.json({ message: 'Time segment deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting time segment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to recalculate and update task's scheduled_time
async function recalculateTaskScheduledTime(taskId) {
  try {
    const result = await query(
      `SELECT COALESCE(
        SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::INTEGER,
        0
      ) as total_minutes
      FROM time_segments
      WHERE task_id = $1 AND deleted_at IS NULL`,
      [taskId]
    );
    
    const scheduledTime = result.rows[0]?.total_minutes || 0;
    
    await query(
      `UPDATE tasks SET scheduled_time = $1, updated_at = NOW() WHERE id = $2`,
      [scheduledTime, taskId]
    );
  } catch (error) {
    console.error('Error recalculating scheduled_time for task:', taskId, error);
    // Don't throw - this is a background update
  }
}

export default router;

