import pkg from 'pg';
import 'dotenv/config';

// Extract the Pool class from the pg package
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// Use ES Module export instead of module.exports
export default pool;
