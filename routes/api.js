const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// POST /api/scan — AJAX card scan
router.post('/scan', requireAuth, async (req, res) => {
  const { direction, card_number } = req.body;
  try {
    const cardResult = await pool.query(`
      SELECT c.*, p.id AS personnel_id, p.full_name
      FROM cards c
      JOIN personnel p ON c.personnel_id = p.id
      WHERE c.card_number = $1 AND c.status = 'active'
    `, [card_number]);

    if (cardResult.rows.length === 0) {
      return res.json({ success: false, message: 'Card not found or inactive' });
    }
    const card = cardResult.rows[0];

    const vehicleResult = await pool.query(
      'SELECT * FROM vehicles WHERE personnel_id = $1', [card.personnel_id]
    );
    if (vehicleResult.rows.length === 0) {
      return res.json({ success: false, message: 'No vehicle assigned to this personnel' });
    }
    const vehicle = vehicleResult.rows[0];

    const newStatus = direction === 'entrance' ? 'in' : 'out';
    await pool.query(
      "UPDATE vehicles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newStatus, vehicle.id]
    );
    await pool.query(`
      INSERT INTO logs (personnel_id, card_number, vehicle_id, plate_number, direction, vehicle_status)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [card.personnel_id, card_number, vehicle.id, vehicle.plate_number, direction, newStatus]);

    res.json({
      success: true,
      name: card.full_name,
      plate: vehicle.plate_number,
      direction,
      newStatus
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error' });
  }
});

module.exports = router;