// Authentication routes for Neon Postgres
import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';

const router = express.Router();

// Sign up (register new user)
router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM public.users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      `INSERT INTO public.users (email, full_name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, full_name, created_at`,
      [email, fullName || null, passwordHash]
    );

    const user = result.rows[0];

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account', details: error.message });
  }
});

// Sign in (login)
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await query(
      'SELECT id, email, full_name, password_hash FROM public.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return user info (without password_hash)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
      },
      message: 'Successfully signed in',
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Failed to sign in', details: error.message });
  }
});

export default router;

