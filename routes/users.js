const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

// GET /users — Page 5 (admin only)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.render('users', { users: users.rows, error: null, success: null });
  } catch (err) {
    console.error(err);
    res.render('users', { users: [], error: 'Server error', success: null });
  }
});

// POST /users — create user (admin only)
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  try {
    // Check if username exists
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      const users = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
      return res.render('users', { users: users.rows, error: 'Username already exists', success: null });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
      [username, hash, role]
    );

    const users = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.render('users', { users: users.rows, error: null, success: 'User created successfully!' });
  } catch (err) {
    console.error(err);
    res.render('users', { users: [], error: 'Server error', success: null });
  }
});

module.exports = router;