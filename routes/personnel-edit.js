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

router.get('/personnel-edit/:personnelId', requireAuth, async (req, res) => {
  const { personnelId } = req.params;
 
  try {
    const [persResult, vehiclesResult, ranksResult, colorsResult, carBrandsResult, motoBrandsResult] =
      await Promise.all([
        pool.query(
          `SELECT p.*, c.card_number
           FROM personnel p
           LEFT JOIN ranks r ON p.rank = r.rank
           LEFT JOIN cards c ON c.personnel_id = p.id
           WHERE p.id = $1`,
          [personnelId]
        ),
        pool.query('SELECT * FROM vehicles WHERE personnel_id = $1 ORDER BY id', [personnelId]),
        pool.query('SELECT id, rank FROM ranks ORDER BY rank'),
        pool.query('SELECT id, name FROM colors ORDER BY id'),
        pool.query('SELECT id, name FROM brands WHERE brands.type = $1 ORDER BY id', ['Car']),
        pool.query('SELECT id, name FROM brands WHERE brands.type = $1 ORDER BY id', ['Motorcycle']),
      ]);
 
    if (persResult.rows.length === 0) {
      return res.status(404).render('personnel-edit', {
        personnel: null,
        vehicles: [],
        ranks: ranksResult.rows,
        colors: colorsResult.rows,
        car_brands: carBrandsResult.rows,
        moto_brands: motoBrandsResult.rows,
        error: 'Personnel not found.',
        success: null,
      });
    }
 
    res.render('personnel-edit', {
      personnel: persResult.rows[0], // single object, not an array — the view expects one person
      vehicles: vehiclesResult.rows,
      ranks: ranksResult.rows,
      colors: colorsResult.rows,
      car_brands: carBrandsResult.rows,
      moto_brands: motoBrandsResult.rows,
      error: null,
      success: null, 
    });
  } catch (err) {
    console.error(err);
    res.render('personnel-edit', {
      personnel: null,
      vehicles: [],
      ranks: [],
      colors: [],
      car_brands: [],
      moto_brands: [],
      error: 'Server error',
      success: null,
    });
  }
});
 
// ---------------------------------------------------------------------------
// POST /personnel-edit/:personnelId
// Saves personnel fields + reconciles the full vehicles array in one
// transaction: existing ids are updated, ids missing from the payload are
// deleted, and rows with no id (new ones added client-side) are inserted.
// ---------------------------------------------------------------------------
router.post('/personnel-edit/:personnelId', requireAuth, requireAdmin, upload.single('photo'), async (req, res) => {
  const { personnelId } = req.params;
  const { name, rank, unit, am, vehicles, card_number } = req.body;
  console.log('name:', name);
  console.log('rank:', rank);
  console.log('unit:', unit);
  console.log('card_number:', card_number);
  const photoPath = req.file ? req.file.filename : null;
  console.log(photoPath);
  // `vehicles` arrives as a JSON string from a hidden input (see the EJS
  // template) — parse it back into an array of vehicle objects.
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (photoPath) {
    await client.query(
      `UPDATE personnel SET full_name = $1, rank = $2, photo = $3, unit=$4, am=$5 WHERE id = $6`,
      [name, rank, photoPath, unit, am, personnelId]
    );}
    else{
      await client.query(
      `UPDATE personnel SET full_name = $1, rank = $2, unit=$3, am=$4 WHERE id = $5`,
      [name, rank, unit, am, personnelId]);
    }
    await client.query(
      `UPDATE cards SET card_number = $1 WHERE id = $2`,
      [card_number, personnelId]
    );

    let vehicleList = [];
  try {
    vehicleList = JSON.parse(vehicles || '[]');
  } catch (e) {
    return res.status(400).render('personnel-edit', {
      personnel: { id: personnelId, name, rank },
      vehicles: [],
      ranks: [], colors: [], car_brands: [], moto_brands: [],
      error: 'Malformed vehicle data.',
      success: null,
    });
  }
  
  // At least one vehicle is mandatory. The UI lock on the first row's
  // remove button should prevent this, but never trust the client — this is
  // the actual enforcement point.
  if (vehicleList.length === 0) {
    return res.status(400).render('personnel-edit', {
      personnel: { id: personnelId, name, rank },
      vehicles: [],
      ranks: [], colors: [], car_brands: [], moto_brands: [],
      error: 'At least one vehicle is required.',
      success: null,
    });
  }
 
    // Ids the client still has after edits — anything in the DB not in this
    // set was deleted client-side and should be removed.
    const keptIds = vehicleList
      .map(v => v.id)
      .filter(id => id !== null && id !== undefined && id !== '');
 
    if (keptIds.length > 0) {
      await client.query(
        `DELETE FROM vehicles WHERE personnel_id = $1 AND id != ALL($2::int[])`,
        [personnelId, keptIds]
      );
    } else {
      // no rows were kept — every existing vehicle was removed
      await client.query(`DELETE FROM vehicles WHERE personnel_id = $1`, [personnelId]);
    }
 
    for (const v of vehicleList) {
      if (v.id) {
        // existing vehicle -> update
        await client.query(
          `UPDATE vehicles
           SET plate_number = $1, brand = $2, color = $3, type = $4, status = $5
           WHERE id = $6 AND personnel_id = $7`,
          [v.plate_number, v.brand, v.color, v.type, v.status, v.id, personnelId]
        );
      } else {
        // new vehicle (added via "+ Add Vehicle" in the UI) -> insert
        await client.query(
          `INSERT INTO vehicles (personnel_id, plate_number, brand, color, type, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [personnelId, v.plate_number, v.brand, v.color, v.type, v.status]
        );
      }
    }

    await client.query('COMMIT');
    res.redirect(`/personnel-edit/${personnelId}?success=1`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).render('personnel-edit', {
      personnel: { id: personnelId, name, rank },
      vehicles: vehicleList,
      ranks: [], colors: [], car_brands: [], moto_brands: [],
      error: 'Server error while saving.',
      success: null,
    });
  } finally {
    client.release();

  }
  
});

export default router;
