// Goals API routes

import express from 'express';
import { query } from '../db.js';

const router = express.Router();

// Get all goals for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new goal
router.post('/', async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier, title, description, parent_goal_id } = req.body;

    if (!tier || !title) {
      return res.status(400).json({ error: 'tier and title are required' });
    }

    const result = await query(
      `INSERT INTO goals (user_id, tier, title, description, parent_goal_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, tier, title, description || null, parent_goal_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a goal
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
      `UPDATE goals 
       SET ${updateFields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a goal
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Goal not found or access denied' });
    }

    res.json({ message: 'Goal deleted successfully', id: result.rows[0].id });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

