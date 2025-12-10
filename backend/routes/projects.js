// Projects API routes

import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Get all projects for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `SELECT * FROM projects 
       WHERE user_id = $1 
       ORDER BY "order" ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new project
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      description,
      start_date,
      deadline,
      priority,
      status,
      color,
      order,
      tags,
      notes,
      progress,
    } = req.body;

    if (!name || !start_date || !deadline) {
      return res.status(400).json({ 
        error: 'name, start_date, and deadline are required' 
      });
    }

    const result = await query(
      `INSERT INTO projects (
        user_id, name, description, start_date, deadline, priority, status,
        color, "order", tags, notes, progress
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        userId,
        name,
        description || null,
        start_date,
        deadline,
        priority || 'medium',
        status || 'not-started',
        color || null,
        order || 0,
        tags || [],
        notes || null,
        progress || 0,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a project
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
      `UPDATE projects 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a project
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    res.json({ message: 'Project deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

