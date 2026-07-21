const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth, redirectIfAuthed } = require('../middleware/auth');

// GET /login
router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('login', { error: null });
});

// POST /login
router.post('/login', redirectIfAuthed, async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.render('login', { error: 'Invalid username or password' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render('login', { error: 'Invalid username or password' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Server error' });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;