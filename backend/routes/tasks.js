// Tasks API routes

import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Get all tasks for a user
router.get('/', async (req, res) => {
  try {
    // Get userId from Clerk authentication (set by clerkAuth middleware)
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch all tasks and calculate scheduled_time from all time_segments
    const result = await query(
      `SELECT t.*,
       COALESCE(
         SUM(EXTRACT(EPOCH FROM (ts.end_time - ts.start_time)) / 60)::INTEGER,
         0
       ) as calculated_scheduled_time
       FROM tasks t
       LEFT JOIN time_segments ts ON t.id = ts.task_id AND ts.deleted_at IS NULL
       WHERE t.user_id = $1 AND t.deleted_at IS NULL
       GROUP BY t.id
       ORDER BY t."order" ASC, t.created_at DESC`,
      [userId]
    );

    // Update scheduled_time if it differs from calculated value
    for (const row of result.rows) {
      if (row.calculated_scheduled_time !== row.scheduled_time) {
        await query(
          `UPDATE tasks SET scheduled_time = $1 WHERE id = $2`,
          [row.calculated_scheduled_time, row.id]
        );
        row.scheduled_time = row.calculated_scheduled_time;
      }
      delete row.calculated_scheduled_time;
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tasks for a specific date
router.get('/by-date', async (req, res) => {
  try {
    const userId = req.userId;
    const date = req.query.date; // Format: YYYY-MM-DD
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    // PRD: Use planned_date instead of deadline for filtering
    // Also fetch time_segments for each task (include all non-deleted segments)
    const result = await query(
      `SELECT t.*, 
       COALESCE(
         json_agg(
           json_build_object(
             'id', ts.id,
             'date', ts.date,
             'start_time', ts.start_time,
             'end_time', ts.end_time
           )
         ) FILTER (WHERE ts.id IS NOT NULL AND ts.deleted_at IS NULL),
         '[]'::json
       ) as time_segments
       FROM tasks t
       LEFT JOIN time_segments ts ON t.id = ts.task_id AND ts.deleted_at IS NULL
       WHERE t.user_id = $1 
       AND (t.planned_date::date = $2::date OR (t.planned_date IS NULL AND t.deadline::date = $2::date))
       AND t.deleted_at IS NULL 
       GROUP BY t.id
       ORDER BY t."order" ASC`,
      [userId, date]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks by date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single task
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch task with time_segments (include all non-deleted segments)
    const result = await query(
      `SELECT t.*, 
       COALESCE(
         json_agg(
           json_build_object(
             'id', ts.id,
             'date', ts.date,
             'start_time', ts.start_time,
             'end_time', ts.end_time
           )
         ) FILTER (WHERE ts.id IS NOT NULL AND ts.deleted_at IS NULL),
         '[]'::json
       ) as time_segments
       FROM tasks t
       LEFT JOIN time_segments ts ON t.id = ts.task_id AND ts.deleted_at IS NULL
       WHERE t.id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL
       GROUP BY t.id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new task
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      title,
      description,
      planned_date, // PRD: The "box" date (required)
      deadline, // PRD: Actual due date (optional)
      priority,
      priority_color, // PRD: Customizable color
      status,
      estimated_minutes,
      project_id,
      tags,
      color,
      parent_task_id,
      start_date,
      default_session_length,
      external_links,
      order,
      // work_time_blocks removed - time_segments are now managed separately
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }
    
    // PRD: planned_date is required
    if (!planned_date) {
      return res.status(400).json({ error: 'planned_date is required' });
    }

    // Get max order if not provided
    let taskOrder = order;
    if (taskOrder === undefined) {
      const orderResult = await query(
        `SELECT COALESCE(MAX("order"), -1) + 1 as next_order 
         FROM tasks 
         WHERE user_id = $1 AND parent_task_id IS NULL`,
        [userId]
      );
      taskOrder = orderResult.rows[0]?.next_order || 0;
    }

    // PRD: Insert with new fields
    const result = await query(
      `INSERT INTO tasks (
        user_id, title, description, planned_date, deadline, priority, priority_color, status,
        estimated_minutes, project_id, tags, color, parent_task_id,
        start_date, default_session_length, external_links, "order"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        userId,
        title,
        description || null,
        planned_date, // PRD: Required
        deadline || null,
        priority || 'medium',
        priority_color || null,
        status || 'todo',
        estimated_minutes || null,
        project_id || null,
        tags || [],
        color || null,
        parent_task_id || null,
        start_date || null,
        default_session_length || null,
        external_links || null,
        taskOrder,
      ]
    );
    
    // Note: Time segments are now created directly via time-segments API
    // No need to handle work_time_blocks here

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const updates = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.user_id;
    delete updates.created_at;
    delete updates.work_time_blocks; // No longer used - time_segments are managed separately

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      updateFields.push(`"${key}" = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id, userId);

    // Update task fields
    const result = await query(
      `UPDATE tasks 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    // Recalculate scheduled_time from all time_segments if not explicitly provided
    if (!updates.scheduled_time) {
      const scheduledResult = await query(
        `SELECT COALESCE(
          SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::INTEGER,
          0
        ) as total_minutes
        FROM time_segments
        WHERE task_id = $1 AND deleted_at IS NULL`,
        [id]
      );
      
      const calculatedScheduledTime = scheduledResult.rows[0]?.total_minutes || 0;
      
      if (calculatedScheduledTime !== result.rows[0].scheduled_time) {
        await query(
          `UPDATE tasks SET scheduled_time = $1 WHERE id = $2`,
          [calculatedScheduledTime, id]
        );
        result.rows[0].scheduled_time = calculatedScheduledTime;
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a task (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Soft delete the task
    const result = await query(
      `UPDATE tasks 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    // Also soft delete all associated time segments to keep Calendar in sync
    await query(
      `UPDATE time_segments 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE task_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    );

    res.json({ message: 'Task deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subtasks
router.get('/:id/subtasks', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `SELECT * FROM tasks 
       WHERE parent_task_id = $1 AND user_id = $2 AND deleted_at IS NULL 
       ORDER BY "order" ASC`,
      [id, userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

