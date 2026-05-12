// src/db-init.js
// Ejecutar UNA sola vez: node src/db-init.js
// Crea las tablas y carga el admin por defecto.

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'prode2026',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
      }
);

async function init() {
  const client = await pool.connect();
  try {
    console.log('🔧 Inicializando base de datos...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username      TEXT PRIMARY KEY,
        password      TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS results (
        match_id  TEXT PRIMARY KEY,
        g1        INTEGER NOT NULL,
        g2        INTEGER NOT NULL,
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

    // Tabla de sesiones para connect-pg-simple
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid    VARCHAR NOT NULL COLLATE "default",
        sess   JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
      );
      CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
    `);

    // Admin por defecto (no falla si ya existe)
    const adminPass = process.env.ADMIN_PASSWORD || 'admin2026';
    await client.query(`
      INSERT INTO users (username, password, display_name, is_admin)
      VALUES ('admin', $1, 'Administrador', TRUE)
      ON CONFLICT (username) DO NOTHING;
    `, [adminPass]);

    console.log('✅ Tablas creadas correctamente.');
    console.log(`✅ Admin creado: usuario "admin" / clave "${adminPass}"`);
    console.log('');
    console.log('Podés arrancar el servidor con: npm start');
  } catch (err) {
    console.error('❌ Error al inicializar:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
