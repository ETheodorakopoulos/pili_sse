import express from 'express';
const router = express.Router();
import pool from '../db/pool.js';
import { requireAuth, redirectIfAuthed } from '../middleware/auth.js';

// GET /scan — Page 1
router.get('/scan', requireAuth, (req, res) => {
  res.render('scan', { result: null, error: null });
});

// POST /scan — process card scan
router.post('/scan', requireAuth, async (req, res) => {
  const { direction, card_number } = req.body;
  try {

    // Look up the card
    const cardResult = await pool.query(`
      SELECT c.*, p.id AS personnel_id, p.full_name
      FROM cards c
      JOIN personnel p ON c.personnel_id = p.id
      WHERE c.card_number = $1 AND c.status = 'active'
    `, [card_number]);

    if (cardResult.rows.length === 0) {
      return res.render('scan', { result: null, error: 'Card not found or inactive' });
    }

    const card = cardResult.rows[0];

    // Look up the personnel's vehicle
    const vehicleResult = await pool.query(
      'SELECT * FROM vehicles WHERE personnel_id = $1', [card.personnel_id]
    );

    if (vehicleResult.rows.length === 0) {
      return res.render('scan', { result: null, error: 'No vehicle assigned to this personnel' });
    }

    const vehicle = vehicleResult.rows[0];

    // Determine new status based on direction
    const newStatus = direction === 'entrance' ? 'in' : 'out';

    // Update vehicle status
    await pool.query(
      "UPDATE vehicles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newStatus, vehicle.id]
    );

    // Create log entry
    await pool.query(`
      INSERT INTO logs (personnel_id, card_number, vehicle_id, direction)
      VALUES ($1, $2, $3, $4)
    `, [card.personnel_id, card_number, vehicle.id, direction]);

    res.render('scan', {
      result: {
        name: card.full_name,
        plate: vehicle.plate_number,
        direction,
        newStatus
      },
      error: null
    });
  } catch (err) {
    console.error(err);
    res.render('scan', { result: null, error: 'Server error' });
  }
});



export default router;
