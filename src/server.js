// src/server.js
require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const path         = require('path');
const pool         = require('./db');
const { MATCHES, calcPoints } = require('./matches');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000');

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false, // la crea db-init.js
  }),
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production', // HTTPS en prod, HTTP en dev
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 días
    sameSite: 'lax',
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'No autenticado' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user?.isAdmin) return res.status(403).json({ error: 'No autorizado' });
  next();
}

// ── Rutas: Auth ───────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Faltan datos' });

  try {
    const { rows } = await pool.query(
      'SELECT username, password, display_name, is_admin FROM users WHERE username = $1',
      [username]
    );
    const user = rows[0];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Usuario o clave incorrectos' });
    }
    req.session.user = {
      username:    user.username,
      displayName: user.display_name,
      isAdmin:     user.is_admin,
    };
    res.json({
      username:    user.username,
      displayName: user.display_name,
      isAdmin:     user.is_admin,
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'No autenticado' });
  res.json(req.session.user);
});

// ── Rutas: Partidos ───────────────────────────────────────────────────────────
app.get('/api/matches', requireAuth, (_req, res) => {
  res.json(MATCHES);
});

// ── Rutas: Resultados ─────────────────────────────────────────────────────────
app.get('/api/results', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT match_id, g1, g2 FROM results');
    const results = {};
    for (const r of rows) results[r.match_id] = { g1: r.g1, g2: r.g2 };
    res.json(results);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/results', requireAdmin, async (req, res) => {
  const { matchId, g1, g2 } = req.body;
  if (!matchId || g1 == null || g2 == null) return res.status(400).json({ error: 'Faltan datos' });
  if (!MATCHES.find(m => m.id === matchId)) return res.status(404).json({ error: 'Partido no encontrado' });

  try {
    await pool.query(`
      INSERT INTO results (match_id, g1, g2, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (match_id) DO UPDATE SET g1 = $2, g2 = $3, updated_at = NOW()
    `, [matchId, g1, g2]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Rutas: Predicciones ───────────────────────────────────────────────────────
app.get('/api/predictions', requireAuth, async (req, res) => {
  // Admin puede pedir predicciones de cualquier usuario; usuarios solo las propias
  const targetUser = req.session.user.isAdmin
    ? (req.query.username || req.session.user.username)
    : req.session.user.username;

  try {
    const { rows } = await pool.query(
      'SELECT match_id, g1, g2 FROM predictions WHERE username = $1',
      [targetUser]
    );
    const preds = {};
    for (const r of rows) preds[r.match_id] = { g1: r.g1, g2: r.g2 };
    res.json(preds);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/predictions', requireAuth, async (req, res) => {
  const { matchId, g1, g2 } = req.body;
  if (!matchId || g1 == null || g2 == null) return res.status(400).json({ error: 'Faltan datos' });

  const match = MATCHES.find(m => m.id === matchId);
  if (!match) return res.status(404).json({ error: 'Partido no encontrado' });

  // Verificar que el partido no haya cerrado (1h antes)
  const matchTime = new Date(`${match.date}T${match.time}:00`);
  const lockTime  = new Date(matchTime.getTime() - 60 * 60 * 1000);
  if (new Date() > lockTime) {
    return res.status(403).json({ error: 'Las predicciones cierran 1 hora antes del partido' });
  }

  try {
    await pool.query(`
      INSERT INTO predictions (username, match_id, g1, g2, saved_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (username, match_id) DO UPDATE SET g1 = $3, g2 = $4, saved_at = NOW()
    `, [req.session.user.username, matchId, g1, g2]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Rutas: Scoreboard ─────────────────────────────────────────────────────────
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
      // Punto de participación: partidos con pred pero sin resultado todavía
      for (const [matchId, pred] of Object.entries(userPreds)) {
        if (!resultsMap[matchId]) {
          // Partido sin resultado → sumar 1 punto solo si hay predicción
          // (mantiene el comportamiento original)
        }
      }
      return { username: u.username, displayName: u.display_name, total, breakdown };
    });

    board.sort((a, b) => b.total - a.total);
    res.json(board);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Rutas: Usuarios (Admin) ───────────────────────────────────────────────────
app.get('/api/users', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT username, display_name, password FROM users WHERE is_admin = FALSE ORDER BY username'
    );
    res.json(rows.map(u => ({ id: u.username, displayName: u.display_name, password: u.password })));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, displayName, password } = req.body;
  if (!username || !displayName || !password) return res.status(400).json({ error: 'Faltan datos' });
  if (/\s/.test(username)) return res.status(400).json({ error: 'El usuario no puede tener espacios' });

  try {
    await pool.query(
      'INSERT INTO users (username, password, display_name, is_admin) VALUES ($1, $2, $3, FALSE)',
      [username, password, displayName]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Usuario ya existe' });
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/api/users/:username', requireAdmin, async (req, res) => {
  const { username } = req.params;
  if (username === 'admin') return res.status(400).json({ error: 'No podés eliminar al admin' });

  try {
    await pool.query('DELETE FROM users WHERE username = $1 AND is_admin = FALSE', [username]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Fallback: SPA ─────────────────────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Arrancar ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n⚽  FIFA World Cup 2026 – Prode`);
  console.log(`🌐  Servidor corriendo en puerto ${PORT}`);
  console.log(`🗄️   PostgreSQL conectado`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔗  http://localhost:${PORT}\n`);
  }
});
