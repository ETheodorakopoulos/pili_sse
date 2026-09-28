import express from 'express';
import pool from '../db/pool.js';
import {requireAuth} from '../middleware/auth.js';
import multer from 'multer';
const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'photos/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// GET /personnel-status — Page 4: all personnel status (user + admin)
router.get('/personnel-status', requireAuth, async (req, res) => {
  try {
    const personnel = await pool.query(`
      SELECT DISTINCT p.id, p.full_name, p.unit, p.photo, r.rank AS rank, c.card_number,
             v.plate_number, v.status AS vehicle_status,
             v.updated_at
      FROM personnel p
      LEFT JOIN ranks r ON p.rank = r.rank
      LEFT JOIN cards c ON c.personnel_id = p.id
      LEFT JOIN vehicles v ON v.personnel_id = p.id
      ORDER BY p.id
    `);
    const units = await pool.query(`
      SELECT id, name FROM units ORDER BY id
    `);
    res.render('personnel-status', { 
      personnel: personnel.rows, 
      units: units.rows,
      error: null,
      success: null});
  } catch (err) {
    console.error(err);
    res.render('personnel-status', { 
      personnel: [] ,
      error: 'Failed to load personnel data.',
      success: null
    });
  }
});

export default router;
