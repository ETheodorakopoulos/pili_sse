import express from 'express';
const router = express.Router();
import pool from '../db/pool.js';
import { requireAuth, redirectIfAuthed } from '../middleware/auth.js';

// POST /api/scan — AJAX card scan
router.post('/scan', requireAuth, async (req, res) => {
  const { direction, card_number } = req.body;
  try {
    const cardResult = await pool.query(`
      SELECT c.*, p.id AS personnel_id, p.full_name, p.photo
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
      INSERT INTO logs (personnel_id, card_number, direction)
      VALUES ($1, $2, $3)
    `, [card.personnel_id, card_number, direction]);

    res.json({
      success: true,
      name: card.full_name,
      plate: vehicle.plate_number,
      direction,
      newStatus,
      photo: card.photo
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error' });
  }
});

// POST /scan — process plate # input
router.post('/scan/:plate_number', requireAuth, async (req, res) => {
  const { plate_number } = req.params;
  const { direction } = req.body;
  try {

    // Look up the plate #
    const plateResult = await pool.query(`
      SELECT DISTINCT p.id AS personnel_id, p.full_name, p.unit, p.photo, r.rank AS rank, c.card_number,
             v.id AS vehicle_id, v.plate_number, v.status AS vehicle_status,
             v.updated_at
      FROM personnel p
      LEFT JOIN ranks r ON p.rank = r.rank
      LEFT JOIN cards c ON c.personnel_id = p.id
      LEFT JOIN vehicles v ON v.personnel_id = p.id
      WHERE v.plate_number = $1 AND c.status = 'active'
    `, [plate_number]);

    if (plateResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plate not found or card inactive' });
    }

    const result = plateResult.rows[0];

    // Determine new status based on direction
    const newStatus = direction === 'entrance' ? 'in' : 'out';

    // Update vehicle status
    await pool.query(
      "UPDATE vehicles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newStatus, result.vehicle_id]
    );

    // Create log entry
    await pool.query(`
      INSERT INTO logs (personnel_id, card_number, vehicle_id, direction)
      VALUES ($1, $2, $3, $4)
    `, [result.personnel_id, result.card_number, result.vehicle_id, direction]);

    res.json({
      success: true,
      name: result.full_name,
      photo: result.photo,
      plate: result.plate_number,
      direction,
      newStatus
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /personnel/delete — AJAX delete personnel+vehicle+card
router.post('/personnel/delete/:personnelId', requireAuth, async (req, res) => {
  const { personnelId } = req.params;
  try {
    console.log(`Attempting to delete ID: ${personnelId}`);

    const persResult = await pool.query(` DELETE FROM personnel WHERE id = $1 `, [personnelId]);

    if (persResult.rows.length === 0) {
      return res.json({ success: false, message: 'Personnel not found in database' });
    }
    
    const vehicleResult = await pool.query(
      'DELETE FROM vehicles WHERE personnel_id = $1', [personnelId]
    );
    if (vehicleResult.rows.length === 0) {
      return res.json({ success: false, message: 'No vehicle assigned to this personnel' });
    }

    const cardResult = await pool.query(
      'DELETE FROM cards WHERE personnel_id = $1', [personnelId]
    );
    if (cardResult.rows.length === 0) {
      return res.json({ success: false, message: 'No card assigned to this personnel' });
    }
   
    return res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    console.error("SQL Error:", error);
    return res.status(500).json({ error: 'Database query failed' });
  } 

}); 

export default router;