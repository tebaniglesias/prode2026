// src/db-init.js — correr UNA sola vez: node src/db-init.js
require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: process.env.DB_HOST||'localhost', port: parseInt(process.env.DB_PORT||'5432'), database: process.env.DB_NAME||'prode2026', user: process.env.DB_USER||'postgres', password: process.env.DB_PASSWORD||'' }
);

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

async function init() {
  const client = await pool.connect();
  try {
    console.log('🔧 Inicializando base de datos...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username          TEXT PRIMARY KEY,
        password_hash     TEXT NOT NULL,
        password_salt     TEXT NOT NULL,
        display_name      TEXT NOT NULL,
        is_admin          BOOLEAN NOT NULL DEFAULT FALSE,
        share_predictions BOOLEAN NOT NULL DEFAULT FALSE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS results (
        match_id   TEXT PRIMARY KEY,
        g1         INTEGER NOT NULL,
        g2         INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS predictions (
        username  TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
        match_id  TEXT NOT NULL,
        g1        INTEGER NOT NULL,
        g2        INTEGER NOT NULL,
        saved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (username, match_id)
      );
    `);

    const adminPass = process.env.ADMIN_PASSWORD || 'admin2026';
    const { hash, salt } = hashPassword(adminPass);
    await client.query(`
      INSERT INTO users (username, password_hash, password_salt, display_name, is_admin)
      VALUES ('admin', $1, $2, 'Administrador', TRUE)
      ON CONFLICT (username) DO NOTHING;
    `, [hash, salt]);

    console.log('✅ Tablas creadas correctamente.');
    console.log(`✅ Admin: usuario "admin" / clave "${adminPass}"`);
    console.log('\nPodés arrancar el servidor con: npm start');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
