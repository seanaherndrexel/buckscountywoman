const path = require('path');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const db = require('./server/db');
const { build } = require('./build');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'bcw-dev-secret-change-me';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DIST = path.join(__dirname, 'dist');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function main() {
  await build();
  await db.query(`CREATE TABLE IF NOT EXISTS subscribers (id SERIAL PRIMARY KEY, email TEXT UNIQUE, source TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.query(`CREATE TABLE IF NOT EXISTS submissions (id SERIAL PRIMARY KEY, type TEXT, data TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`);

  const app = express();
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));

  // simple per-IP rate limit for form posts
  const hits = new Map();
  const limited = (req) => {
    const k = req.ip, now = Date.now();
    const arr = (hits.get(k) || []).filter((t) => now - t < 3600e3);
    arr.push(now); hits.set(k, arr);
    return arr.length > 30;
  };

  app.post('/api/subscribe', async (req, res) => {
    try {
      if (limited(req)) return res.status(429).json({ ok: false, error: 'Too many tries. Please wait a bit.' });
      const email = String((req.body || {}).email || '').trim().toLowerCase();
      if ((req.body || {}).website) return res.json({ ok: true }); // honeypot
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
      await db.query('INSERT INTO subscribers (email, source) VALUES ($1,$2) ON CONFLICT (email) DO NOTHING', [email, String((req.body || {}).source || 'site').slice(0, 60)]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' }); }
  });

  app.post('/api/form', async (req, res) => {
    try {
      if (limited(req)) return res.status(429).json({ ok: false, error: 'Too many tries. Please wait a bit.' });
      const b = req.body || {};
      if (b.website) return res.json({ ok: true });
      const type = String(b.type || 'contact').slice(0, 40);
      const data = {};
      for (const [k, v] of Object.entries(b.fields || {})) data[String(k).slice(0, 40)] = String(v).slice(0, 4000);
      if (!Object.keys(data).length) return res.status(400).json({ ok: false, error: 'Please fill in the form.' });
      await db.query('INSERT INTO submissions (type, data) VALUES ($1,$2)', [type, JSON.stringify(data)]);
      if (data.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email) && (type === 'membership' || data.newsletter === 'yes')) {
        await db.query('INSERT INTO subscribers (email, source) VALUES ($1,$2) ON CONFLICT (email) DO NOTHING', [data.email.toLowerCase(), type]);
      }
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' }); }
  });

  // Publisher's private inbox: /admin?key=ADMIN_KEY
  app.get('/admin', async (req, res) => {
    if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(404).send('Not found');
    const subs = (await db.query('SELECT email, source, created_at FROM subscribers ORDER BY id DESC LIMIT 500')).rows;
    const forms = (await db.query('SELECT type, data, created_at FROM submissions ORDER BY id DESC LIMIT 300')).rows;
    res.set('X-Robots-Tag', 'noindex').send(`<!doctype html><meta charset="utf-8"><title>BCW inbox</title><style>body{font:15px system-ui;margin:24px;color:#3b1f4a}td,th{border-bottom:1px solid #eadcf5;padding:6px 10px;text-align:left;vertical-align:top}pre{white-space:pre-wrap;margin:0}</style>
<h1>Bucks County Woman inbox</h1><p>Storage: ${db.persistent ? 'database (permanent)' : 'temporary memory (resets on restart)'}</p>
<h2>Subscribers (${subs.length})</h2><table><tr><th>Email</th><th>Source</th><th>When</th></tr>${subs.map((s) => `<tr><td>${esc(s.email)}</td><td>${esc(s.source)}</td><td>${esc(new Date(s.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' }))}</td></tr>`).join('')}</table>
<h2>Form submissions (${forms.length})</h2><table><tr><th>Type</th><th>Details</th><th>When</th></tr>${forms.map((f) => { let d = {}; try { d = JSON.parse(f.data); } catch (e) {} return `<tr><td>${esc(f.type)}</td><td><pre>${esc(Object.entries(d).map(([k, v]) => k + ': ' + v).join('\n'))}</pre></td><td>${esc(new Date(f.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' }))}</td></tr>`; }).join('')}</table>`);
  });

  app.get('/healthz', (req, res) => res.json({ ok: true, db: db.persistent }));

  try {
    await require('./server/app-api')(app, db, { secret: SECRET, crypto });
  } catch (e) { console.error('Community app API not loaded:', e.message); }

  app.use(express.static(DIST, { extensions: ['html'], maxAge: '10m' }));
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: '10m' }));
  app.use((req, res) => res.status(404).sendFile(path.join(DIST, '404.html')));

  app.listen(PORT, () => console.log('Bucks County Woman listening on ' + PORT));
}
main().catch((e) => { console.error(e); process.exit(1); });
