import express from 'express';
const router = express.Router();
import pool from '../db/pool.js';
import { requireAuth, redirectIfAuthed } from '../middleware/auth.js';

// GET /card-history — Page 3 (user + admin)
router.get('/card-history', requireAuth, async (req, res) => {
  const { personnel_id, vehicle_id, log_date } = req.query;
  let cardInfo = null;
  let logs = [];

  // Load all personnel for the dropdown (always needed)
  const personnelList = await pool.query(`
    SELECT p.id, p.rank, p.full_name, c.card_number
    FROM personnel p
    LEFT JOIN cards c ON c.personnel_id = p.id
    ORDER BY p.full_name
  `);

  // Load all vehicles for the dropdown (always needed)
  const vehicleList = await pool.query(`
    SELECT v.id, v.brand, v.plate_number, v.personnel_id
    FROM vehicles v
    ORDER BY v.plate_number
  `);

  // Determine which of the two dropdowns was used to search. personnel_id
  // takes priority if somehow both are present.
  let searchCard = null;

  if (personnel_id) {
    const cardLookup = await pool.query(`
      SELECT c.card_number FROM cards c WHERE c.personnel_id = $1
    `, [personnel_id]);
    if (cardLookup.rows.length > 0) {
      searchCard = cardLookup.rows[0].card_number;
    }
  } else if (vehicle_id) {
    const cardLookup = await pool.query(`
      SELECT c.card_number
      FROM vehicles v
      JOIN cards c ON c.personnel_id = v.personnel_id
      WHERE v.id = $1
    `, [vehicle_id]);
    if (cardLookup.rows.length > 0) {
      searchCard = cardLookup.rows[0].card_number;
    }
  }

  if (searchCard) {
    try {
      const cardResult = await pool.query(`
        SELECT c.card_number, c.status AS card_status, p.full_name, p.id AS personnel_id,
               v.plate_number, v.status AS vehicle_status
        FROM cards c
        JOIN personnel p ON c.personnel_id = p.id
        LEFT JOIN vehicles v ON v.personnel_id = p.id
        WHERE c.card_number = $1
      `, [searchCard]);

      if (cardResult.rows.length > 0) {
        cardInfo = cardResult.rows[0];

        // log_date narrows the same card's logs to a single calendar day.
        // DATE(created_at) truncates the timestamp to just its date part,
        // so it matches regardless of what time of day each log happened.
        if (log_date) {
          const logResult = await pool.query(`
            SELECT * FROM logs
            WHERE card_number = $1 AND DATE(created_at) = $2
            ORDER BY created_at DESC
          `, [searchCard, log_date]);
          logs = logResult.rows;
        } else {
          const logResult = await pool.query(`
            SELECT * FROM logs WHERE card_number = $1 ORDER BY created_at DESC
          `, [searchCard]);
          logs = logResult.rows;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  res.render('card-history', {
    cardInfo,
    logs,
    personnel: personnelList.rows,
    vehicles: vehicleList.rows,
    searched: !!searchCard,
    selectedPersonnelId: personnel_id || '',
    selectedVehicleId: vehicle_id || '',
    selectedLogDate: log_date || ''
  });
});

export default router;