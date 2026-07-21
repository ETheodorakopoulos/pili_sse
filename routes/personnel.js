const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

// GET /personnel — Page 2: create personnel (admin only)
router.get('/personnel', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [personnel, ranks] = await Promise.all([
      pool.query(`
        SELECT p.*, r.rank, c.card_number, c.status AS card_status,
               v.plate_number, v.status AS vehicle_status
        FROM personnel p
        LEFT JOIN ranks r ON p.rank = r.rank
        LEFT JOIN cards c ON c.personnel_id = p.id
        LEFT JOIN vehicles v ON v.personnel_id = p.id
        ORDER BY p.created_at DESC
      `),
      pool.query('SELECT id, rank FROM ranks ORDER BY id')
    ]);
    res.render('personnel', { personnel: personnel.rows, ranks: ranks.rows, error: null, success: null });
  } catch (err) {
    console.error(err);
    res.render('personnel', { personnel: [], ranks: [], error: 'Server error', success: null });
  }
});

// POST /personnel — create personnel + assign card + vehicle (admin only)
router.post('/personnel', requireAuth, requireAdmin, async (req, res) => {
  const { full_name, card_number, plate_number, rank } = req.body;
  console.log('=== CREATE PERSONNEL HIT ===');
  console.log('Body:', req.body);
  try {
    // Check if card number already exists
    const cardCheck = await pool.query('SELECT id FROM cards WHERE card_number = $1', [card_number]);
    if (cardCheck.rows.length > 0) {
      const [personnel, ranks] = await Promise.all([
        pool.query(`
          SELECT p.*, r.rank, c.card_number, c.status AS card_status,
                 v.plate_number, v.status AS vehicle_status
          FROM personnel p
          LEFT JOIN ranks r ON p.rank = r.rank
          LEFT JOIN cards c ON c.personnel_id = p.id
          LEFT JOIN vehicles v ON v.personnel_id = p.id
          ORDER BY p.created_at DESC
        `),
        pool.query('SELECT id, rank FROM ranks ORDER BY rank')
      ]);
      return res.render('personnel', { personnel: personnel.rows, ranks: ranks.rows, error: 'Card number already in use', success: null });
    }

    // Create personnel (with rank_id)
    const personResult = await pool.query(
      'INSERT INTO personnel (full_name, rank) VALUES ($1, $2) RETURNING id',
      [full_name, rank || null]
    );
    console.log('INSERT personnel succeeded');
    const personnelId = personResult.rows[0].id;

    // Assign card
    await pool.query(
      'INSERT INTO cards (card_number, personnel_id) VALUES ($1, $2)',
      [card_number, personnelId]
    );
    console.log('INSERT cards succeeded');
    // Create vehicle
    await pool.query(
      'INSERT INTO vehicles (personnel_id, plate_number) VALUES ($1, $2)',
      [personnelId, plate_number]
    );
    console.log('INSERT vehicles succeeded');
    const [personnel, ranks] = await Promise.all([
      pool.query(`
        SELECT p.*, r.rank AS rank, c.card_number AS card_number, c.status AS card_status,
               v.plate_number AS plate_number, v.status AS vehicle_status
        FROM personnel p
        LEFT JOIN ranks r ON p.rank = r.rank
        LEFT JOIN cards c ON c.personnel_id = p.id
        LEFT JOIN vehicles v ON v.personnel_id = p.id
        ORDER BY p.created_at DESC
      `),
      pool.query('SELECT id, rank FROM ranks ORDER BY rank')
    ]);
    res.render('personnel', { personnel: personnel.rows, ranks: ranks.rows, error: null, success: 'Personnel created successfully!' });
  } catch (err) {
    console.error(err);
    res.render('personnel', { personnel: [], ranks: [], error: 'Server error', success: null });
  }
});

// GET /personnel-status — Page 4: all personnel status (user + admin)
router.get('/personnel-status', requireAuth, async (req, res) => {
  try {
    const personnel = await pool.query(`
      SELECT p.id, p.full_name, r.rank AS rank, c.card_number,
             v.plate_number, v.status AS vehicle_status,
             v.updated_at
      FROM personnel p
      LEFT JOIN ranks r ON p.rank = r.rank
      LEFT JOIN cards c ON c.personnel_id = p.id
      LEFT JOIN vehicles v ON v.personnel_id = p.id
      ORDER BY p.full_name
    `);
    res.render('personnel-status', { personnel: personnel.rows });
  } catch (err) {
    console.error(err);
    res.render('personnel-status', { personnel: [] });
  }
});

module.exports = router;