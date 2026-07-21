require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./pool');

async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      -- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Personnel table
CREATE TABLE IF NOT EXISTS personnel (
    id SERIAL PRIMARY KEY,
    rank VARCHAR(50),
    full_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ranks table
CREATE TABLE IF NOT EXISTS ranks (
    id SERIAL PRIMARY KEY,
    rank VARCHAR(50),
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    card_number VARCHAR(50) UNIQUE NOT NULL,
    personnel_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    personnel_id INTEGER REFERENCES personnel(id) ON DELETE CASCADE,
    plate_number VARCHAR(50) NOT NULL,
    status VARCHAR(10) DEFAULT 'out' CHECK (status IN ('in', 'out')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    personnel_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
    card_number VARCHAR(50) NOT NULL,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    plate_number VARCHAR(50),
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('entrance', 'exit')),
    vehicle_status VARCHAR(10) NOT NULL CHECK (vehicle_status IN ('in', 'out')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast card lookups
CREATE INDEX IF NOT EXISTS idx_cards_card_number ON cards(card_number);
CREATE INDEX IF NOT EXISTS idx_logs_card_number ON logs(card_number);

-- Insert default admin user (password: admin123 — change after first login!)
-- The hash below is for 'admin123' — regenerate with bcrypt if needed
INSERT INTO users (username, password_hash, role)
VALUES ('admin', '$2a$10$5mUIINAbhpaWBHwuHsVN3uKaabta7UTdiiesmamyyeDJ.XK2bIjja', 'admin')
ON CONFLICT (username) DO NOTHING;
    `);
  
    console.log('Database initialized successfully!');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();