// ============================================================
// ELECTROBOY 80 — Backend Node.js + Express
// Stack : Express · SQLite (better-sqlite3) · JWT · Multer
// ============================================================

const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'eb80_secret_change_in_prod';

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static('public')); // serve HTML files

// ===== DATABASE =====
const db = new Database('./electroboy80.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'fan',       -- 'admin' | 'fan' | 'partner'
    partner_type TEXT,             -- 'media' | 'venue' | 'sponsor' | 'booking'
    partner_access TEXT DEFAULT 'stats', -- 'stats' | 'press' | 'events' | 'full'
    alerts TEXT DEFAULT '[]',      -- JSON array of alert types
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,            -- 'post' | 'event' | 'news' | 'exclusive' | 'press'
    body TEXT,
    audience TEXT DEFAULT 'all',   -- 'all' | 'fans' | 'partners' | 'vip'
    networks TEXT DEFAULT '[]',    -- JSON array ['Facebook','Instagram',...]
    media TEXT DEFAULT '[]',       -- JSON array of file paths
    status TEXT DEFAULT 'draft',   -- 'draft' | 'published' | 'scheduled'
    scheduled_at TEXT,
    author_id INTEGER,
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT DEFAULT '21:00',
    venue TEXT,
    city TEXT,
    country TEXT DEFAULT 'FR',
    ticket_url TEXT,
    poster TEXT,
    description TEXT,
    networks TEXT DEFAULT '[]',
    status TEXT DEFAULT 'upcoming', -- 'upcoming' | 'tonight' | 'past' | 'cancelled' | 'tba'
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER,
    user_id INTEGER,
    type TEXT DEFAULT 'like',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(content_id, user_id, type),
    FOREIGN KEY(content_id) REFERENCES content(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER,
    from_name TEXT,
    from_email TEXT,
    type TEXT DEFAULT 'contact',   -- 'contact' | 'booking' | 'deal' | 'fan'
    subject TEXT,
    body TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS social_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER,
    network TEXT,
    status TEXT,                   -- 'success' | 'failed' | 'pending'
    external_id TEXT,              -- ID du post sur le réseau
    error TEXT,
    published_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER,
    networks TEXT DEFAULT '[]',
    scheduled_at TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending' | 'done' | 'failed'
    FOREIGN KEY(content_id) REFERENCES content(id)
  );
`);

// Seed admin user
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@electroboy80.fr');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin1234', 10);
  db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?,?,?,?)`).run('Admin EB80', 'admin@electroboy80.fr', hash, 'admin');
  console.log('✓ Admin créé : admin@electroboy80.fr / admin1234');
}

// Seed sample event (today's concert)
const todayEvents = db.prepare('SELECT id FROM events WHERE date = date("now")').all();
if (!todayEvents.length) {
  db.prepare(`INSERT INTO events (name,date,time,venue,city,status) VALUES (?,date('now'),?,?,?,?)`)
    .run('Brasserie du Pilat','21:00','Brasserie du Pilat','St Julien Molin Molette','tonight');
}

// ===== FILE UPLOAD =====
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// ===== AUTH MIDDLEWARE =====
function authRequired(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requis' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Accès interdit' });
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Token invalide' });
    }
  };
}

// ===== SOCIAL PUBLISHING (STUBS → Remplacer par vraies APIs) =====
const socialPublishers = {
  Facebook: async (content, mediaFiles) => {
    // TODO: Remplacer par Facebook Graph API
    // POST https://graph.facebook.com/v19.0/{page-id}/feed
    // avec access_token, message, attached_media
    console.log('[Facebook] Simulated publish:', content.title);
    return { success: true, external_id: 'fb_' + Date.now() };
  },
  Instagram: async (content, mediaFiles) => {
    // TODO: Remplacer par Instagram Graph API
    // 1. Upload media → /media endpoint
    // 2. Publish → /media_publish
    console.log('[Instagram] Simulated publish:', content.title);
    return { success: true, external_id: 'ig_' + Date.now() };
  },
  TikTok: async (content, mediaFiles) => {
    // TODO: TikTok Content Posting API
    console.log('[TikTok] Simulated publish:', content.title);
    return { success: true, external_id: 'tt_' + Date.now() };
  },
  YouTube: async (content, mediaFiles) => {
    // TODO: YouTube Data API v3
    console.log('[YouTube] Simulated publish:', content.title);
    return { success: true, external_id: 'yt_' + Date.now() };
  },
  Spotify: async (content, mediaFiles) => {
    // TODO: Spotify for Artists API (actuellement read-only pour les podcasts)
    console.log('[Spotify] Simulated publish:', content.title);
    return { success: true, external_id: 'sp_' + Date.now() };
  },
};

async function publishToNetworks(content, networks, mediaFiles = []) {
  const results = [];
  for (const network of networks) {
    if (!socialPublishers[network]) continue;
    try {
      const result = await socialPublishers[network](content, mediaFiles);
      db.prepare('INSERT INTO social_log (content_id,network,status,external_id) VALUES (?,?,?,?)')
        .run(content.id, network, 'success', result.external_id);
      results.push({ network, status: 'success', id: result.external_id });
    } catch (err) {
      db.prepare('INSERT INTO social_log (content_id,network,status,error) VALUES (?,?,?,?)')
        .run(content.id, network, 'failed', err.message);
      results.push({ network, status: 'failed', error: err.message });
    }
  }
  return results;
}

// ===== SCHEDULER (vérifie toutes les minutes) =====
setInterval(async () => {
  const due = db.prepare(`
    SELECT sp.*, c.title, c.type, c.body, c.audience, c.media
    FROM scheduled_posts sp
    JOIN content c ON c.id = sp.content_id
    WHERE sp.status = 'pending' AND sp.scheduled_at <= datetime('now')
  `).all();

  for (const s of due) {
    try {
      const networks = JSON.parse(s.networks || '[]');
      const content = { id: s.content_id, title: s.title, body: s.body };
      await publishToNetworks(content, networks);
      db.prepare('UPDATE scheduled_posts SET status=? WHERE id=?').run('done', s.id);
      db.prepare('UPDATE content SET status=?, published_at=datetime("now") WHERE id=?').run('published', s.content_id);
      console.log(`[Scheduler] Publié: ${s.title} sur ${networks.join(', ')}`);
    } catch (err) {
      db.prepare('UPDATE scheduled_posts SET status=? WHERE id=?').run('failed', s.id);
    }
  }
}, 60 * 1000);

// ========================================================
// ===== ROUTES AUTH =====
// ========================================================

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'fan', partner_type } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Champs requis manquants' });
  if (role === 'admin') return res.status(403).json({ error: 'Impossible de créer un admin via inscription' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const info = db.prepare('INSERT INTO users (name,email,password,role,partner_type) VALUES (?,?,?,?,?)')
      .run(name, email, hash, role, partner_type || null);
    const token = jwt.sign({ id: info.lastInsertRowid, email, role, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: info.lastInsertRowid, name, email, role } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email déjà utilisé' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, partner_type: user.partner_type } });
});

// GET /api/auth/me
app.get('/api/auth/me', authRequired(), (req, res) => {
  const user = db.prepare('SELECT id,name,email,role,partner_type,partner_access,alerts,status,created_at FROM users WHERE id=?').get(req.user.id);
  res.json(user);
});

// ========================================================
// ===== ROUTES USERS (ADMIN) =====
// ========================================================

app.get('/api/users', authRequired(['admin']), (req, res) => {
  const { role, status } = req.query;
  let q = 'SELECT id,name,email,role,partner_type,partner_access,status,created_at FROM users WHERE 1=1';
  const params = [];
  if (role) { q += ' AND role=?'; params.push(role); }
  if (status) { q += ' AND status=?'; params.push(status); }
  res.json(db.prepare(q).all(...params));
});

app.patch('/api/users/:id', authRequired(['admin']), (req, res) => {
  const { status, partner_access, alerts } = req.body;
  db.prepare('UPDATE users SET status=COALESCE(?,status), partner_access=COALESCE(?,partner_access), alerts=COALESCE(?,alerts) WHERE id=?')
    .run(status||null, partner_access||null, alerts?JSON.stringify(alerts):null, req.params.id);
  res.json({ success: true });
});

app.delete('/api/users/:id', authRequired(['admin']), (req, res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ========================================================
// ===== ROUTES CONTENT =====
// ========================================================

// GET /api/content — filtré par rôle
app.get('/api/content', authRequired(), (req, res) => {
  const { type, status, audience } = req.query;
  const role = req.user.role;

  let q = 'SELECT c.*,u.name as author_name FROM content c LEFT JOIN users u ON c.author_id=u.id WHERE 1=1';
  const params = [];

  // Filtrer par audience selon le rôle
  if (role === 'fan') {
    q += ` AND (c.audience='all' OR c.audience='fans')`;
  } else if (role === 'partner') {
    q += ` AND (c.audience='all' OR c.audience='partners')`;
  }
  // Admin voit tout

  if (type) { q += ' AND c.type=?'; params.push(type); }
  if (status) { q += ' AND c.status=?'; params.push(status); }
  if (audience && role === 'admin') { q += ' AND c.audience=?'; params.push(audience); }

  q += ' ORDER BY c.created_at DESC';
  const rows = db.prepare(q).all(...params);
  res.json(rows.map(r => ({ ...r, networks: JSON.parse(r.networks||'[]'), media: JSON.parse(r.media||'[]') })));
});

// POST /api/content — ADMIN only
app.post('/api/content', authRequired(['admin']), upload.array('media', 10), async (req, res) => {
  const { title, type, body, audience, networks, status, scheduled_at } = req.body;
  if (!title || !type) return res.status(400).json({ error: 'title et type requis' });

  const nets = typeof networks === 'string' ? JSON.parse(networks) : (networks || []);
  const mediaFiles = (req.files || []).map(f => `/uploads/${f.filename}`);

  const info = db.prepare(`
    INSERT INTO content (title,type,body,audience,networks,media,status,scheduled_at,author_id,published_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    title, type, body||'', audience||'all',
    JSON.stringify(nets), JSON.stringify(mediaFiles),
    status||'draft', scheduled_at||null, req.user.id,
    status==='published' ? new Date().toISOString() : null
  );

  const content = { id: info.lastInsertRowid, title, type, body, audience };
  let publishResults = [];

  if (status === 'published' && nets.length) {
    publishResults = await publishToNetworks(content, nets, mediaFiles);
  } else if (status === 'scheduled' && scheduled_at && nets.length) {
    db.prepare('INSERT INTO scheduled_posts (content_id,networks,scheduled_at) VALUES (?,?,?)')
      .run(info.lastInsertRowid, JSON.stringify(nets), scheduled_at);
  }

  res.json({ id: info.lastInsertRowid, publishResults });
});

// PATCH /api/content/:id
app.patch('/api/content/:id', authRequired(['admin']), upload.array('media', 10), async (req, res) => {
  const { title, body, status, networks } = req.body;
  const nets = networks ? (typeof networks==='string'?JSON.parse(networks):networks) : null;
  db.prepare('UPDATE content SET title=COALESCE(?,title),body=COALESCE(?,body),status=COALESCE(?,status),networks=COALESCE(?,networks) WHERE id=?')
    .run(title||null, body||null, status||null, nets?JSON.stringify(nets):null, req.params.id);
  res.json({ success: true });
});

// DELETE /api/content/:id
app.delete('/api/content/:id', authRequired(['admin']), (req, res) => {
  db.prepare('DELETE FROM content WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/content/:id/publish — Republier sur RS
app.post('/api/content/:id/publish', authRequired(['admin']), async (req, res) => {
  const content = db.prepare('SELECT * FROM content WHERE id=?').get(req.params.id);
  if (!content) return res.status(404).json({ error: 'Contenu introuvable' });
  const { networks } = req.body;
  const nets = networks || JSON.parse(content.networks||'[]');
  const results = await publishToNetworks(content, nets);
  db.prepare('UPDATE content SET status=?,published_at=datetime("now") WHERE id=?').run('published', content.id);
  res.json({ results });
});

// ========================================================
// ===== ROUTES EVENTS =====
// ========================================================

app.get('/api/events', (req, res) => {
  const { status } = req.query;
  let q = 'SELECT * FROM events WHERE 1=1';
  const params = [];
  if (status) { q += ' AND status=?'; params.push(status); }
  q += ' ORDER BY date ASC';
  res.json(db.prepare(q).all(...params).map(e=>({...e,networks:JSON.parse(e.networks||'[]')})));
});

app.post('/api/events', authRequired(['admin']), upload.single('poster'), async (req, res) => {
  const { name, date, time, venue, city, ticket_url, description, networks, status } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'name et date requis' });
  const nets = typeof networks==='string'?JSON.parse(networks):(networks||[]);
  const poster = req.file ? `/uploads/${req.file.filename}` : null;
  const info = db.prepare(`
    INSERT INTO events (name,date,time,venue,city,ticket_url,poster,description,networks,status)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(name,date,time||'21:00',venue||'',city||'',ticket_url||'',poster,description||'',JSON.stringify(nets),status||'upcoming');

  // Auto-publier l'annonce du concert
  if (nets.length) {
    const fake = { id: info.lastInsertRowid, title: `Concert : ${name}`, body: `📅 ${date} · ${time} · ${venue} · ${city}` };
    await publishToNetworks(fake, nets);
  }
  res.json({ id: info.lastInsertRowid });
});

app.patch('/api/events/:id', authRequired(['admin']), (req, res) => {
  const { name, date, time, venue, city, status, ticket_url } = req.body;
  db.prepare('UPDATE events SET name=COALESCE(?,name),date=COALESCE(?,date),time=COALESCE(?,time),venue=COALESCE(?,venue),city=COALESCE(?,city),status=COALESCE(?,status),ticket_url=COALESCE(?,ticket_url) WHERE id=?')
    .run(name||null,date||null,time||null,venue||null,city||null,status||null,ticket_url||null,req.params.id);
  res.json({ success: true });
});

app.delete('/api/events/:id', authRequired(['admin']), (req, res) => {
  db.prepare('DELETE FROM events WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ========================================================
// ===== ROUTES REACTIONS =====
// ========================================================

app.post('/api/content/:id/react', authRequired(['fan','admin','partner']), (req, res) => {
  const { type = 'like' } = req.body;
  try {
    db.prepare('INSERT INTO reactions (content_id,user_id,type) VALUES (?,?,?)').run(req.params.id, req.user.id, type);
    res.json({ action: 'added' });
  } catch {
    db.prepare('DELETE FROM reactions WHERE content_id=? AND user_id=? AND type=?').run(req.params.id, req.user.id, type);
    res.json({ action: 'removed' });
  }
});

app.get('/api/content/:id/reactions', (req, res) => {
  const counts = db.prepare('SELECT type,COUNT(*) as count FROM reactions WHERE content_id=? GROUP BY type').all(req.params.id);
  res.json(counts);
});

// ========================================================
// ===== ROUTES MESSAGES =====
// ========================================================

app.get('/api/messages', authRequired(['admin']), (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all());
});

app.post('/api/messages', (req, res) => {
  const { from_name, from_email, type='contact', subject, body } = req.body;
  if (!from_email || !body) return res.status(400).json({ error: 'Email et message requis' });
  const info = db.prepare('INSERT INTO messages (from_name,from_email,type,subject,body) VALUES (?,?,?,?,?)').run(from_name||'',from_email,type,subject||'',body);
  res.json({ id: info.lastInsertRowid });
});

app.patch('/api/messages/:id/read', authRequired(['admin']), (req, res) => {
  db.prepare('UPDATE messages SET read=1 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ========================================================
// ===== ROUTES STATS (ADMIN) =====
// ========================================================

app.get('/api/stats', authRequired(['admin']), (req, res) => {
  res.json({
    fans: db.prepare(`SELECT COUNT(*) as count FROM users WHERE role='fan'`).get().count,
    partners: db.prepare(`SELECT COUNT(*) as count FROM users WHERE role='partner'`).get().count,
    events: db.prepare(`SELECT COUNT(*) as count FROM events WHERE status='upcoming' OR status='tonight'`).get().count,
    published: db.prepare(`SELECT COUNT(*) as count FROM content WHERE status='published'`).get().count,
    messages_unread: db.prepare('SELECT COUNT(*) as count FROM messages WHERE read=0').get().count,
    social_posts: db.prepare(`SELECT COUNT(*) as count FROM social_log WHERE status='success'`).get().count,
    recent_fans: db.prepare(`SELECT name,email,created_at FROM users WHERE role='fan' ORDER BY created_at DESC LIMIT 5`).all(),
    upcoming_events: db.prepare(`SELECT * FROM events WHERE status IN ('upcoming','tonight') ORDER BY date ASC LIMIT 5`).all(),
  });
});

// ===== SOCIAL LOG =====
app.get('/api/social/log', authRequired(['admin']), (req, res) => {
  res.json(db.prepare('SELECT sl.*,c.title FROM social_log sl LEFT JOIN content c ON c.id=sl.content_id ORDER BY sl.published_at DESC LIMIT 50').all());
});

// ===== SCHEDULED POSTS =====
app.get('/api/scheduled', authRequired(['admin']), (req, res) => {
  res.json(db.prepare(`
    SELECT sp.*,c.title,c.type FROM scheduled_posts sp
    JOIN content c ON c.id=sp.content_id
    WHERE sp.status='pending' ORDER BY sp.scheduled_at ASC
  `).all().map(s=>({...s,networks:JSON.parse(s.networks||'[]')})));
});

app.delete('/api/scheduled/:id', authRequired(['admin']), (req, res) => {
  db.prepare('DELETE FROM scheduled_posts WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   ELECTROBOY 80 — Backend v1.0        ║
  ║   http://localhost:${PORT}               ║
  ╠═══════════════════════════════════════╣
  ║  POST /api/auth/register              ║
  ║  POST /api/auth/login                 ║
  ║  GET  /api/content                    ║
  ║  POST /api/content   (admin)          ║
  ║  GET  /api/events                     ║
  ║  GET  /api/stats     (admin)          ║
  ╚═══════════════════════════════════════╝
  Admin: admin@electroboy80.fr / admin1234
  `);
});

module.exports = app;
