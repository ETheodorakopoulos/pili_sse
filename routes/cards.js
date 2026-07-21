const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// GET /card-history — Page 3 (user + admin)
router.get('/card-history', requireAuth, async (req, res) => {
  const { card_number, personnel_id } = req.query;
  let cardInfo = null;
  let logs = [];

  // Load all personnel for the dropdown (always needed)
  const personnelList = await pool.query(`
    SELECT p.id, p.full_name, c.card_number
    FROM personnel p
    LEFT JOIN cards c ON c.personnel_id = p.id
    ORDER BY p.full_name
  `);

  // Determine which search was used
  let searchCard = null;

  if (card_number && card_number.trim()) {
    searchCard = card_number.trim();
  } else if (personnel_id) {
    // Look up the card number for this personnel
    const cardLookup = await pool.query(`
      SELECT c.card_number FROM cards c WHERE c.personnel_id = $1
    `, [personnel_id]);
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

        const logResult = await pool.query(`
          SELECT * FROM logs WHERE card_number = $1 ORDER BY created_at DESC
        `, [searchCard]);
        logs = logResult.rows;
      }
    } catch (err) {
      console.error(err);
    }
  }

  res.render('card-history', {
    cardInfo,
    logs,
    personnel: personnelList.rows,
    searched: !!searchCard,
    selectedPersonnelId: personnel_id || ''
  });
});

module.exports = router;