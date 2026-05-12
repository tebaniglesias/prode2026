// src/server.js
require('dotenv').config();

const express   = require('express');
const crypto    = require('crypto');
const path      = require('path');
const pool      = require('./db');
const { MATCHES, calcPoints } = require('./matches');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(express.json());
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Crypto ────────────────────────────────────────────────────────────────────
function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}
function verifyPassword(password, storedHash, storedSalt) {
  return hashPassword(password, storedSalt).hash === storedHash;
}

// ── Token store ───────────────────────────────────────────────────────────────
const tokens = new Map();
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function createToken(username) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { username, expires: Date.now() + TOKEN_TTL_MS });
  return token;
}
function validateToken(token) {
  if (!token) return null;
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expires) { tokens.delete(token); return null; }
  return entry.username;
}
function revokeToken(token) { if (token) tokens.delete(token); }
function getToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const username = validateToken(getToken(req));
  if (!username) return res.status(401).json({ error: 'No autorizado' });
  req.username = username;
  next();
}
async function requireAdmin(req, res, next) {
  const username = validateToken(getToken(req));
  if (!username) return res.status(401).json({ error: 'No autorizado' });
  try {
    const { rows } = await pool.query('SELECT is_admin FROM users WHERE username = $1', [username]);
    if (!rows[0]?.is_admin) return res.status(403).json({ error: 'No autorizado' });
    req.username = username;
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
}

// ── POST /api/login ───────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const { rows } = await pool.query(
      'SELECT username, password_hash, password_salt, display_name, is_admin, share_predictions FROM users WHERE username = $1',
      [username]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
      return res.status(401).json({ error: 'Usuario o clave incorrectos' });
    }
    const token = createToken(username);
    res.json({ token, username: user.username, displayName: user.display_name, isAdmin: user.is_admin, sharePredictions: user.share_predictions || false });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── POST /api/logout ──────────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => { revokeToken(getToken(req)); res.json({ ok: true }); });

// ── GET /api/matches ──────────────────────────────────────────────────────────
app.get('/api/matches', requireAuth, (_req, res) => res.json(MATCHES));

// ── GET /api/results ──────────────────────────────────────────────────────────
app.get('/api/results', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT match_id, g1, g2 FROM results');
    const results = {};
    for (const r of rows) results[r.match_id] = { g1: r.g1, g2: r.g2 };
    res.json(results);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /api/results  (admin) ────────────────────────────────────────────────
app.post('/api/results', requireAdmin, async (req, res) => {
  const { matchId, g1, g2 } = req.body;
  if (!matchId || typeof g1 !== 'number' || typeof g2 !== 'number') return res.status(400).json({ error: 'Datos inválidos' });
  if (!MATCHES.find(m => m.id === matchId)) return res.status(404).json({ error: 'Partido no encontrado' });
  try {
    await pool.query(
      'INSERT INTO results (match_id, g1, g2, updated_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (match_id) DO UPDATE SET g1=$2,g2=$3,updated_at=NOW()',
      [matchId, g1, g2]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── DELETE /api/results/:matchId  (admin) ─────────────────────────────────────
app.delete('/api/results/:matchId', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM results WHERE match_id = $1', [req.params.matchId]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── GET /api/predictions ──────────────────────────────────────────────────────
app.get('/api/predictions', requireAuth, async (req, res) => {
  try {
    const { rows: reqRows } = await pool.query('SELECT is_admin FROM users WHERE username = $1', [req.username]);
    const isAdmin = reqRows[0]?.is_admin;
    const targetUser = (isAdmin && req.query.username) ? req.query.username : req.username;

    if (!isAdmin && targetUser !== req.username) {
      const { rows } = await pool.query('SELECT share_predictions FROM users WHERE username = $1', [targetUser]);
      if (!rows[0]?.share_predictions) {
        return res.status(403).json({ error: 'Este usuario mantiene sus predicciones en privado 🙈' });
      }
    }

    const { rows } = await pool.query('SELECT match_id, g1, g2 FROM predictions WHERE username = $1', [targetUser]);
    const preds = {};
    for (const r of rows) preds[r.match_id] = { g1: r.g1, g2: r.g2 };
    res.json(preds);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /api/predictions  (jugadores only) ───────────────────────────────────
app.post('/api/predictions', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT is_admin FROM users WHERE username = $1', [req.username]);
    if (rows[0]?.is_admin) return res.status(403).json({ error: 'El admin no puede cargar predicciones' });
  } catch (err) { return res.status(500).json({ error: 'Error interno' }); }

  const { matchId, g1, g2 } = req.body;
  if (!matchId || typeof g1 !== 'number' || typeof g2 !== 'number' || g1 < 0 || g2 < 0) {
    return res.status(400).json({ error: 'Valores inválidos' });
  }
  const match = MATCHES.find(m => m.id === matchId);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
  if (Date.now() > new Date(`${match.date}T${match.time}:00`).getTime() - 3600000) {
    return res.status(403).json({ error: 'Las predicciones cierran 1 hora antes del partido' });
  }
  try {
    await pool.query(
      'INSERT INTO predictions (username, match_id, g1, g2, saved_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (username, match_id) DO UPDATE SET g1=$3,g2=$4,saved_at=NOW()',
      [req.username, matchId, g1, g2]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── PATCH /api/me/share ───────────────────────────────────────────────────────
app.patch('/api/me/share', requireAuth, async (req, res) => {
  const share = !!req.body.share;
  try {
    await pool.query('UPDATE users SET share_predictions = $1 WHERE username = $2', [share, req.username]);
    res.json({ ok: true, share });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── GET /api/scoreboard ───────────────────────────────────────────────────────
app.get('/api/scoreboard', requireAuth, async (_req, res) => {
  try {
    const [{ rows: users }, { rows: results }, { rows: preds }] = await Promise.all([
      pool.query('SELECT username, display_name FROM users WHERE is_admin = FALSE'),
      pool.query('SELECT match_id, g1, g2 FROM results'),
      pool.query('SELECT username, match_id, g1, g2 FROM predictions'),
    ]);
    const resultsMap = {};
    for (const r of results) resultsMap[r.match_id] = { g1: r.g1, g2: r.g2 };
    const predsMap = {};
    for (const p of preds) {
      if (!predsMap[p.username]) predsMap[p.username] = {};
      predsMap[p.username][p.match_id] = { g1: p.g1, g2: p.g2 };
    }
    const board = users.map(u => {
      const userPreds = predsMap[u.username] || {};
      let total = 0;
      const breakdown = {};
      for (const [matchId, real] of Object.entries(resultsMap)) {
        const pred = userPreds[matchId];
        if (!pred) continue;
        const pts = calcPoints(pred, real);
        total += pts;
        breakdown[matchId] = { points: pts, pred, real };
      }
      return { userId: u.username, displayName: u.display_name, total, breakdown };
    });
    board.sort((a, b) => b.total - a.total);
    res.json(board);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── GET /api/users  (admin) ───────────────────────────────────────────────────
app.get('/api/users', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT username, display_name FROM users WHERE is_admin = FALSE ORDER BY username');
    res.json(rows.map(u => ({ id: u.username, displayName: u.display_name })));
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /api/users  (admin) ──────────────────────────────────────────────────
app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, displayName, password } = req.body;
  if (!username || !displayName || !password) return res.status(400).json({ error: 'Faltan campos' });
  if (/\s/.test(username)) return res.status(400).json({ error: 'El usuario no puede tener espacios' });
  const { hash, salt } = hashPassword(password);
  try {
    await pool.query(
      'INSERT INTO users (username, password_hash, password_salt, display_name, is_admin) VALUES ($1,$2,$3,$4,FALSE)',
      [username, hash, salt, displayName]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Usuario ya existe' });
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── PATCH /api/users/:id/password  (admin) ────────────────────────────────────
app.patch('/api/users/:id/password', requireAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Falta la nueva clave' });
  const { hash, salt } = hashPassword(password);
  try {
    const result = await pool.query(
      'UPDATE users SET password_hash=$1, password_salt=$2 WHERE username=$3 AND is_admin=FALSE',
      [hash, salt, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── DELETE /api/users/:id  (admin) ────────────────────────────────────────────
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === 'admin') return res.status(403).json({ error: 'No se puede eliminar al admin' });
  try {
    await pool.query('DELETE FROM users WHERE username=$1 AND is_admin=FALSE', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── GET /api/knockout/matches ─────────────────────────────────────────────────
app.get('/api/knockout/matches', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, round, round_label, match_num, t1, t2, date, time, venue, g1, g2, winner FROM knockout_matches ORDER BY date, time, match_num'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── PATCH /api/knockout/matches/:id/teams  (admin: actualizar equipos de R32) ──
app.patch('/api/knockout/matches/:id/teams', requireAdmin, async (req, res) => {
  const { t1, t2 } = req.body;
  const { id } = req.params;
  if (!t1 && !t2) return res.status(400).json({ error: 'Nada que actualizar' });
  try {
    const sets = [];
    const vals = [];
    let i = 1;
    if (t1 !== undefined) { sets.push(`t1=$${i++}`); vals.push(t1); }
    if (t2 !== undefined) { sets.push(`t2=$${i++}`); vals.push(t2); }
    sets.push(`updated_at=NOW()`);
    vals.push(id);
    await pool.query(`UPDATE knockout_matches SET ${sets.join(',')} WHERE id=$${i}`, vals);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /api/knockout/matches/:id/result  (admin: cargar resultado + ganador y propagar)
app.post('/api/knockout/matches/:id/result', requireAdmin, async (req, res) => {
  const { g1, g2, winner } = req.body;
  const { id } = req.params;

  if (typeof g1 !== 'number' || typeof g2 !== 'number' || !winner) {
    return res.status(400).json({ error: 'Faltan datos: g1, g2 y winner son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Guardar resultado y ganador en el partido actual
    await client.query(
      'UPDATE knockout_matches SET g1=$1, g2=$2, winner=$3, updated_at=NOW() WHERE id=$4',
      [g1, g2, winner, id]
    );

    // 2. Buscar si este partido alimenta a otro (next_match_id + next_slot)
    const { rows } = await client.query(
      'SELECT next_match_id, next_slot FROM knockout_matches WHERE id=$1',
      [id]
    );
    const { next_match_id, next_slot } = rows[0] || {};

    if (next_match_id && next_slot) {
      // 3. Propagar el ganador al slot correspondiente del siguiente partido
      const field = next_slot === 1 ? 't1' : 't2';
      await client.query(
        `UPDATE knockout_matches SET ${field}=$1, updated_at=NOW() WHERE id=$2`,
        [winner, next_match_id]
      );
    }

    // 4. Caso especial: perdedor de SF va al tercer puesto
    if (id === 'SF_1' || id === 'SF_2') {
      const { rows: sfRows } = await client.query(
        'SELECT t1, t2 FROM knockout_matches WHERE id=$1', [id]
      );
      const loser = winner === sfRows[0].t1 ? sfRows[0].t2 : sfRows[0].t1;
      const tpSlot = id === 'SF_1' ? 't1' : 't2';
      await client.query(
        `UPDATE knockout_matches SET ${tpSlot}=$1, updated_at=NOW() WHERE id='TP_1'`,
        [loser]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, propagated: !!(next_match_id) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cargando resultado knockout:', err.message);
    res.status(500).json({ error: 'Error interno' });
  } finally {
    client.release();
  }
});

// ── DELETE /api/knockout/matches/:id/result  (admin: borrar resultado y limpiar propagación)
app.delete('/api/knockout/matches/:id/result', requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener datos del partido antes de borrar
    const { rows } = await client.query(
      'SELECT next_match_id, next_slot, winner FROM knockout_matches WHERE id=$1', [req.params.id]
    );
    const { next_match_id, next_slot, winner } = rows[0] || {};

    // Borrar resultado y ganador del partido
    await client.query(
      'UPDATE knockout_matches SET g1=NULL, g2=NULL, winner=NULL, updated_at=NOW() WHERE id=$1',
      [req.params.id]
    );

    // Si había propagado un ganador, limpiarlo del siguiente partido
    if (next_match_id && next_slot && winner) {
      const field = next_slot === 1 ? 't1' : 't2';
      await client.query(
        `UPDATE knockout_matches SET ${field}='Por definir', updated_at=NOW() WHERE id=$1`,
        [next_match_id]
      );
    }

    // Limpiar tercer puesto si era una SF
    if (req.params.id === 'SF_1') {
      await client.query(`UPDATE knockout_matches SET t1='Por definir', updated_at=NOW() WHERE id='TP_1'`);
    }
    if (req.params.id === 'SF_2') {
      await client.query(`UPDATE knockout_matches SET t2='Por definir', updated_at=NOW() WHERE id='TP_1'`);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error interno' });
  } finally {
    client.release();
  }
});

// ── GET /api/knockout/predictions ─────────────────────────────────────────────
app.get('/api/knockout/predictions', requireAuth, async (req, res) => {
  try {
    const { rows: reqRows } = await pool.query('SELECT is_admin FROM users WHERE username=$1', [req.username]);
    const isAdmin = reqRows[0]?.is_admin;
    const targetUser = (isAdmin && req.query.username) ? req.query.username : req.username;

    if (!isAdmin && targetUser !== req.username) {
      const { rows } = await pool.query('SELECT share_predictions FROM users WHERE username=$1', [targetUser]);
      if (!rows[0]?.share_predictions) {
        return res.status(403).json({ error: 'Este usuario mantiene sus predicciones en privado 🙈' });
      }
    }

    const { rows } = await pool.query(
      'SELECT match_id, g1, g2 FROM knockout_predictions WHERE username=$1', [targetUser]
    );
    const preds = {};
    for (const r of rows) preds[r.match_id] = { g1: r.g1, g2: r.g2 };
    res.json(preds);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── POST /api/knockout/predictions  (jugadores only) ─────────────────────────
app.post('/api/knockout/predictions', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT is_admin FROM users WHERE username=$1', [req.username]);
    if (rows[0]?.is_admin) return res.status(403).json({ error: 'El admin no puede cargar predicciones' });
  } catch (err) { return res.status(500).json({ error: 'Error interno' }); }

  const { matchId, g1, g2 } = req.body;
  if (!matchId || typeof g1 !== 'number' || typeof g2 !== 'number' || g1 < 0 || g2 < 0) {
    return res.status(400).json({ error: 'Valores inválidos' });
  }

  try {
    const { rows } = await pool.query('SELECT date, time, t1, t2 FROM knockout_matches WHERE id=$1', [matchId]);
    const match = rows[0];
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    if (match.t1 === 'Por definir' || match.t2 === 'Por definir') {
      return res.status(403).json({ error: 'Esperá a que se confirmen los equipos' });
    }
    if (match.date && match.time) {
      const lockTime = new Date(`${match.date}T${match.time}:00`).getTime() - 3600000;
      if (Date.now() > lockTime) {
        return res.status(403).json({ error: 'Las predicciones cierran 1 hora antes del partido' });
      }
    }
    await pool.query(
      'INSERT INTO knockout_predictions (username, match_id, g1, g2, saved_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (username, match_id) DO UPDATE SET g1=$3,g2=$4,saved_at=NOW()',
      [req.username, matchId, g1, g2]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── GET /api/knockout/scoreboard ──────────────────────────────────────────────
app.get('/api/knockout/scoreboard', requireAuth, async (_req, res) => {
  try {
    const [{ rows: users }, { rows: matches }, { rows: preds }] = await Promise.all([
      pool.query('SELECT username, display_name FROM users WHERE is_admin=FALSE'),
      pool.query('SELECT id, g1, g2 FROM knockout_matches WHERE g1 IS NOT NULL AND g2 IS NOT NULL'),
      pool.query('SELECT username, match_id, g1, g2 FROM knockout_predictions'),
    ]);

    const resultsMap = {};
    for (const m of matches) resultsMap[m.id] = { g1: m.g1, g2: m.g2 };

    const predsMap = {};
    for (const p of preds) {
      if (!predsMap[p.username]) predsMap[p.username] = {};
      predsMap[p.username][p.match_id] = { g1: p.g1, g2: p.g2 };
    }

    const board = users.map(u => {
      const userPreds = predsMap[u.username] || {};
      let total = 0;
      const breakdown = {};
      for (const [matchId, real] of Object.entries(resultsMap)) {
        const pred = userPreds[matchId];
        if (!pred) continue;
        const pts = calcPoints(pred, real);
        total += pts;
        breakdown[matchId] = { points: pts, pred, real };
      }
      return { userId: u.username, displayName: u.display_name, total, breakdown };
    });

    board.sort((a, b) => b.total - a.total);
    res.json(board);
  } catch (err) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Fallback SPA ──────────────────────────────────────────────────────────────
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n⚽  FIFA World Cup 2026 – Prode`);
  console.log(`🌐  Puerto ${PORT} | 🗄️  PostgreSQL\n`);
});
