import express from 'express';
import pool from '../db/pool.js';
import {requireAuth} from '../middleware/auth.js';
import {requireAdmin} from '../middleware/rbac.js';
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

// GET /personnel — Page 2: create personnel (admin only)
router.get('/personnel', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [personnel, ranks, brands, colors, car_brands, moto_brands, units] = await Promise.all([
      pool.query(`
        SELECT p.*, r.rank, c.card_number, c.status AS card_status,
               v.plate_number, v.status AS vehicle_status
        FROM personnel p
        LEFT JOIN ranks r ON p.rank = r.rank
        LEFT JOIN cards c ON c.personnel_id = p.id
        LEFT JOIN vehicles v ON v.personnel_id = p.id
        ORDER BY p.created_at DESC
      `),
      pool.query('SELECT id, rank FROM ranks ORDER BY id'),
      pool.query('SELECT id, type, name FROM brands ORDER BY id'),
      pool.query('SELECT id, name FROM colors ORDER BY id'),
      pool.query('SELECT id, name FROM brands WHERE brands.type = $1 ORDER BY id', ['Car']),
      pool.query('SELECT id, name FROM brands WHERE brands.type = $1 ORDER BY id', ['Motorcycle']),
      pool.query('SELECT id, name FROM units ORDER BY id')  ]);
    res.render('personnel', { personnel: personnel.rows, ranks: ranks.rows, brands: brands.rows, colors: colors.rows, car_brands: car_brands.rows, moto_brands: moto_brands.rows, units: units.rows, error: null, success: null });
  } catch (err) {
    console.error(err);
    res.render('personnel', { personnel: [], ranks: [], error: 'Server error', success: null });
  }
});

// POST /personnel — create personnel + assign card + vehicle (admin only)
router.post('/personnel', requireAuth, requireAdmin, upload.single('photo'), async (req, res) => {
  const { full_name, card_number, plate_number, rank, unit, color, brand, vehicle, am } = req.body; 
  const photoPath = req.file ? req.file.filename : null; 
  console.log('=== CREATE PERSONNEL HIT ===');
  console.log('File:', photoPath);
  console.log('Body:', req.body);
  try {
    // Check if card number already exists
    const cardCheck = await pool.query('SELECT id FROM cards WHERE card_number = $1', [card_number]);
    const amCheck = await pool.query('SELECT id FROM personnel WHERE am =$1', [am]);
    if (cardCheck.rows.length > 0 || amCheck.rows.length >0) {
      const [personnel, ranks, colors, car_brands, moto_brands, units] = await Promise.all([
        pool.query(`
          SELECT p.*, r.rank, c.card_number, c.status AS card_status,
                 v.plate_number, v.status AS vehicle_status
          FROM personnel p
          LEFT JOIN ranks r ON p.rank = r.rank
          LEFT JOIN cards c ON c.personnel_id = p.id
          LEFT JOIN vehicles v ON v.personnel_id = p.id
          ORDER BY p.created_at DESC
        `),
        pool.query('SELECT id, rank FROM ranks ORDER BY rank'),
        pool.query('SELECT id, name FROM colors ORDER BY id'),
        pool.query('SELECT id, name FROM brands WHERE brands.type = $1 ORDER BY id', ['Car']),
        pool.query('SELECT id, name FROM brands WHERE brands.type = $1 ORDER BY id', ['Motorcycle']),
        pool.query('SELECT id, name FROM units ORDER BY id')  ]);
      return res.render('personnel', { personnel: personnel.rows, ranks: ranks.rows, brands: brands.rows, colors: colors.rows, car_brands: car_brands.rows, moto_brands: moto_brands.rows, units: units.rows, error: null, success: null });
  }

    // Create personnel
    const personResult = await pool.query(
      'INSERT INTO personnel (full_name, rank, photo, unit, am) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [full_name, rank, photoPath, unit, am || null]
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
      'INSERT INTO vehicles (personnel_id, plate_number, color, brand, type) VALUES ($1, $2, $3, $4, $5)',
      [personnelId, plate_number, color, brand, vehicle]
    );
    console.log('INSERT vehicles succeeded');
    const [personnel, ranks, colors, car_brands, moto_brands, units] = await Promise.all([
      pool.query(`
        SELECT p.*, r.rank AS rank, c.card_number AS card_number, c.status AS card_status,
               v.plate_number AS plate_number, v.status AS vehicle_status
        FROM personnel p
        LEFT JOIN ranks r ON p.rank = r.rank
        LEFT JOIN cards c ON c.personnel_id = p.id
        LEFT JOIN vehicles v ON v.personnel_id = p.id
        ORDER BY p.created_at DESC
      `),
      pool.query('SELECT id, rank FROM ranks ORDER BY rank'),
      pool.query('SELECT id, name FROM colors ORDER BY id'),
      pool.query('SELECT id, name FROM brands WHERE brands.type = $1 ORDER BY id', ['Car']),
      pool.query('SELECT id, name FROM brands WHERE brands.type = $1 ORDER BY id', ['Motorcycle']),
      pool.query('SELECT id, name FROM units ORDER BY id')  ]);
    res.render('personnel', { personnel: personnel.rows, ranks: ranks.rows, colors: colors.rows, car_brands: car_brands.rows, moto_brands: moto_brands.rows, units: units.rows, error: null, success: 'Personnel created successfully!' });
  // POST /personnel catch
} catch (err) {
  console.error(err);
  res.render('personnel', {
    personnel: [], ranks: [], colors: [], car_brands: [], moto_brands: [],
    error: 'Server error', success: null
  });
}
});



export default router;
