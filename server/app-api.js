'use strict';
// Bucks County Woman community app API. Mounted by the host server:
//   require('./server/app-api')(app, db, helpers)
// All routes live under /api/app/. Emails are never returned by any route.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const COOKIE = 'bcw_app';
const SESSION_DAYS = 60;
const POST_TYPES = ['ask', 'recommend', 'event', 'offer', 'general'];
const REPORT_REASONS = ['harassment', 'hate', 'politics-religion', 'spam', 'privacy', 'misinformation', 'unsafe', 'other'];
const STAFF_EMAIL = 'staff@system.buckscountywoman.invalid';
const HIDE_AT = 3;

const TOWNS = [
  'Doylestown', 'New Hope & Solebury', 'Newtown', 'Yardley & Lower Makefield', 'Bensalem',
  'Levittown', 'Bristol', 'Quakertown', 'Perkasie & Sellersville', 'Warminster & Warrington',
  'Langhorne & Middletown', 'Chalfont & New Britain', 'Southampton & Richboro',
  'Morrisville & Falls', 'Upper Bucks'
];
const CIRCLES = [
  'New Moms', 'Women in Business', 'LGBTQIA+', '50 and Better', 'Caregivers',
  'Disability Community', 'Newcomers', 'Homemaking', 'Local Makers & Artists'
];

const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/\+/g, ' plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Plain text only: drop control characters, normalise newlines, trim.
const clean = (v, max) => String(v == null ? '' : v)
  .replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
  .replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|co|io|info|biz|us|me|ly|shop|store|xyz|app|site|link)\b)/i;
const toInt = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
const idList = (ids) => ids.map(toInt).filter(Boolean).join(',') || '0';

module.exports = async function appApi(app, db, helpers) {
  const secret = String((helpers && helpers.secret) || '');
  if (!secret) throw new Error('app-api: helpers.secret is required');
  const q = async (sql, params) => (await db.query(sql, params || [])).rows;

  // ---------- tables ----------
  await q(`CREATE TABLE IF NOT EXISTS app_groups (
    id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    kind TEXT NOT NULL, sort_order INTEGER DEFAULT 0)`);
  await q(`CREATE TABLE IF NOT EXISTS app_members (
    id SERIAL PRIMARY KEY, first_name TEXT NOT NULL, last_initial TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, home_group_id INTEGER, is_staff BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS app_group_members (
    id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL, member_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS app_posts (
    id SERIAL PRIMARY KEY, group_id INTEGER NOT NULL, member_id INTEGER NOT NULL,
    type TEXT DEFAULT 'general', title TEXT DEFAULT '', body TEXT NOT NULL,
    hidden BOOLEAN DEFAULT FALSE, is_welcome BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS app_replies (
    id SERIAL PRIMARY KEY, post_id INTEGER NOT NULL, member_id INTEGER NOT NULL, body TEXT NOT NULL,
    hidden BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS app_hearts (
    id SERIAL PRIMARY KEY, post_id INTEGER NOT NULL, member_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS app_reports (
    id SERIAL PRIMARY KEY, target_type TEXT NOT NULL, target_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL, reason TEXT DEFAULT 'other', note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW())`);

  // ---------- idempotent seed ----------
  const seedGroups = TOWNS.map((n, i) => [n, 'town', i + 1]).concat(CIRCLES.map((n, i) => [n, 'circle', 100 + i]));
  for (const [name, kind, order] of seedGroups) {
    await q('INSERT INTO app_groups (slug, name, kind, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (slug) DO NOTHING',
      [slugify(name), name, kind, order]);
  }
  let staff = (await q('SELECT id FROM app_members WHERE email = $1', [STAFF_EMAIL]))[0];
  if (!staff) {
    staff = (await q(`INSERT INTO app_members (first_name, last_initial, email, is_staff)
      VALUES ('Bucks County Woman', '', $1, TRUE) RETURNING id`, [STAFF_EMAIL]))[0];
  }
  for (const g of await q('SELECT id, name, kind FROM app_groups ORDER BY sort_order')) {
    const has = await q('SELECT id FROM app_posts WHERE group_id = $1 AND is_welcome = TRUE', [g.id]);
    if (has.length) continue;
    const label = g.kind === 'town' ? `${g.name} group` : `${g.name} circle`;
    await q(`INSERT INTO app_posts (group_id, member_id, type, title, body, is_welcome)
      VALUES ($1,$2,'general',$3,$4,TRUE)`, [g.id, staff.id, `Welcome to ${g.name}`,
      `Welcome to the ${label}, and thank you for being here. Say hello, ask a question, or share something good happening near you.`]);
  }

  // ---------- sessions ----------
  const sign = (v) => crypto.createHmac('sha256', secret).update(v).digest('base64url');
  const isSecure = (req) => req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  const setSession = (req, res, id) => {
    const v = `${id}.${Date.now() + SESSION_DAYS * 864e5}`;
    res.setHeader('Set-Cookie', `${COOKIE}=${v}.${sign(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${isSecure(req) ? '; Secure' : ''}`);
  };
  const clearSession = (req, res) => res.setHeader('Set-Cookie',
    `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure(req) ? '; Secure' : ''}`);
  const sessionId = (req) => {
    const m = String(req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
    if (!m) return 0;
    const parts = m.slice(COOKIE.length + 1).split('.');
    if (parts.length !== 3) return 0;
    const a = Buffer.from(parts[2]); const b = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 0;
    if (Number(parts[1]) < Date.now()) return 0;
    return toInt(parts[0]);
  };
  const loadMember = async (req) => {
    const id = sessionId(req);
    if (!id) return null;
    return (await q('SELECT id, first_name, last_initial, home_group_id, is_staff, created_at FROM app_members WHERE id = $1', [id]))[0] || null;
  };

  // ---------- helpers ----------
  const fail = (res, code, message) => res.status(code).json({ error: message });
  const wrap = (fn, needAuth) => async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const me = await loadMember(req);
      if (needAuth && !me) return fail(res, 401, 'Please join or sign in first.');
      await fn(req, res, me);
    } catch (err) {
      console.error('app-api error', err);
      if (!res.headersSent) fail(res, 500, 'Something went wrong on our side. Please try again.');
    }
  };
  const displayName = (r) => r.is_staff ? r.first_name : `${r.first_name} ${r.last_initial}.`;
  const myGroupIds = async (id) => (await q('SELECT group_id FROM app_group_members WHERE member_id = $1', [id])).map((r) => r.group_id);
  const joinGroup = async (memberId, groupId) => {
    const has = await q('SELECT id FROM app_group_members WHERE member_id = $1 AND group_id = $2', [memberId, groupId]);
    if (!has.length) await q('INSERT INTO app_group_members (group_id, member_id) VALUES ($1,$2)', [groupId, memberId]);
  };
  const publicMember = async (m) => ({
    id: m.id, name: displayName(m), first_name: m.first_name, last_initial: m.last_initial,
    home_group_id: m.home_group_id, member_since: m.created_at, groups: await myGroupIds(m.id), preview: true
  });
  const isNew = (m) => Date.now() - new Date(m.created_at).getTime() < 864e5;
  const hourAgo = () => new Date(Date.now() - 36e5).toISOString();
  const myReports = async (meId, type) => new Set((await q(
    'SELECT target_id FROM app_reports WHERE member_id = $1 AND target_type = $2', [meId, type])).map((r) => r.target_id));

  const shapePosts = async (rows, me) => {
    if (!rows.length) return [];
    const ids = idList(rows.map((r) => r.id));
    const hearts = await q(`SELECT post_id, member_id FROM app_hearts WHERE post_id IN (${ids})`);
    const replies = await q(`SELECT post_id FROM app_replies WHERE hidden = FALSE AND post_id IN (${ids})`);
    return rows.map((r) => ({
      id: r.id, group_id: r.group_id, group_name: r.group_name, type: r.type, title: r.title, body: r.body,
      created_at: r.created_at, is_welcome: r.is_welcome,
      author: { name: displayName(r), is_staff: r.is_staff },
      mine: r.member_id === me.id,
      hearts: hearts.filter((h) => h.post_id === r.id).length,
      hearted: hearts.some((h) => h.post_id === r.id && h.member_id === me.id),
      reply_count: replies.filter((x) => x.post_id === r.id).length
    }));
  };
  const POST_SELECT = `SELECT p.id, p.group_id, p.member_id, p.type, p.title, p.body, p.created_at, p.is_welcome,
    g.name AS group_name, m.first_name, m.last_initial, m.is_staff
    FROM app_posts p JOIN app_groups g ON g.id = p.group_id JOIN app_members m ON m.id = p.member_id`;

  // ---------- groups ----------
  app.get('/api/app/groups', wrap(async (req, res, me) => {
    const groups = await q('SELECT id, slug, name, kind FROM app_groups ORDER BY sort_order');
    const mine = me ? await myGroupIds(me.id) : [];
    const counts = await q('SELECT gm.group_id FROM app_group_members gm');
    res.json({ groups: groups.map((g) => ({
      ...g, joined: mine.includes(g.id), is_home: !!me && me.home_group_id === g.id,
      members: counts.filter((c) => c.group_id === g.id).length
    })) });
  }));

  app.post('/api/app/groups/:id/join', wrap(async (req, res, me) => {
    const g = (await q('SELECT id FROM app_groups WHERE id = $1', [toInt(req.params.id)]))[0];
    if (!g) return fail(res, 404, 'We could not find that group.');
    await joinGroup(me.id, g.id);
    res.json({ ok: true, groups: await myGroupIds(me.id) });
  }, true));

  app.post('/api/app/groups/:id/leave', wrap(async (req, res, me) => {
    const gid = toInt(req.params.id);
    if (gid === me.home_group_id) return fail(res, 400, 'This is your home town group. Change your town in your profile to leave it.');
    await q('DELETE FROM app_group_members WHERE member_id = $1 AND group_id = $2', [me.id, gid]);
    res.json({ ok: true, groups: await myGroupIds(me.id) });
  }, true));

  // ---------- join / sign in ----------
  app.post('/api/app/join', wrap(async (req, res) => {
    const b = req.body || {};
    const first = clean(b.first_name, 30).replace(/\s+/g, ' ');
    const initial = clean(b.last_initial, 4).replace(/[^\p{L}]/gu, '').slice(0, 1).toUpperCase();
    const email = clean(b.email, 200).toLowerCase();
    if (!/^[\p{L}][\p{L}' -]{0,29}$/u.test(first)) return fail(res, 400, 'Please enter your first name using letters only.');
    if (!initial) return fail(res, 400, 'Please enter the first letter of your last name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(res, 400, 'Please enter a valid email address.');
    if (b.agree !== true) return fail(res, 400, 'Please confirm that you agree to the community guidelines and that you are a woman aged 18 or older.');
    const home = (await q("SELECT id FROM app_groups WHERE id = $1 AND kind = 'town'", [toInt(b.home_group_id)]))[0];
    if (!home) return fail(res, 400, 'Please choose your home town group.');
    if ((await q('SELECT id FROM app_members WHERE email = $1', [email])).length) {
      return fail(res, 409, 'That email already has a membership. Please sign in instead.');
    }
    const m = (await q(`INSERT INTO app_members (first_name, last_initial, email, home_group_id)
      VALUES ($1,$2,$3,$4) RETURNING id, first_name, last_initial, home_group_id, is_staff, created_at`,
      [first.charAt(0).toUpperCase() + first.slice(1), initial, email, home.id]))[0];
    await joinGroup(m.id, home.id);
    setSession(req, res, m.id);
    res.status(201).json({ member: await publicMember(m) });
  }));

  app.post('/api/app/signin', wrap(async (req, res) => {
    const email = clean((req.body || {}).email, 200).toLowerCase();
    const m = (await q(`SELECT id, first_name, last_initial, home_group_id, is_staff, created_at
      FROM app_members WHERE email = $1 AND is_staff = FALSE`, [email]))[0];
    if (!m) return fail(res, 404, 'We could not find a membership for that email. Please check it or join below.');
    setSession(req, res, m.id);
    res.json({ member: await publicMember(m) });
  }));

  app.post('/api/app/signout', wrap(async (req, res) => { clearSession(req, res); res.json({ ok: true }); }));

  app.get('/api/app/me', wrap(async (req, res, me) => {
    res.json({ member: me ? await publicMember(me) : null });
  }));

  app.patch('/api/app/me', wrap(async (req, res, me) => {
    const home = (await q("SELECT id FROM app_groups WHERE id = $1 AND kind = 'town'", [toInt((req.body || {}).home_group_id)]))[0];
    if (!home) return fail(res, 400, 'Please choose a town group.');
    if (home.id !== me.home_group_id) {
      if (me.home_group_id) await q('DELETE FROM app_group_members WHERE member_id = $1 AND group_id = $2', [me.id, me.home_group_id]);
      await q('UPDATE app_members SET home_group_id = $1 WHERE id = $2', [home.id, me.id]);
      await joinGroup(me.id, home.id);
      me.home_group_id = home.id;
    }
    res.json({ member: await publicMember(me) });
  }, true));

  app.delete('/api/app/me', wrap(async (req, res, me) => {
    if (me.is_staff) return fail(res, 400, 'This account cannot be deleted here.');
    const posts = idList((await q('SELECT id FROM app_posts WHERE member_id = $1', [me.id])).map((r) => r.id));
    const replyIds = idList((await q(`SELECT id FROM app_replies WHERE member_id = $1 OR post_id IN (${posts})`, [me.id])).map((r) => r.id));
    await q(`DELETE FROM app_reports WHERE member_id = $1 OR (target_type = 'post' AND target_id IN (${posts}))
      OR (target_type = 'reply' AND target_id IN (${replyIds}))`, [me.id]);
    await q(`DELETE FROM app_hearts WHERE member_id = $1 OR post_id IN (${posts})`, [me.id]);
    await q(`DELETE FROM app_replies WHERE member_id = $1 OR post_id IN (${posts})`, [me.id]);
    await q('DELETE FROM app_posts WHERE member_id = $1', [me.id]);
    await q('DELETE FROM app_group_members WHERE member_id = $1', [me.id]);
    await q('DELETE FROM app_members WHERE id = $1', [me.id]);
    clearSession(req, res);
    res.json({ ok: true });
  }, true));

  // ---------- feed ----------
  app.get('/api/app/feed', wrap(async (req, res, me) => {
    const which = String(req.query.group || 'mine');
    let ids;
    if (which === 'mine') ids = await myGroupIds(me.id);
    else {
      const g = (await q('SELECT id FROM app_groups WHERE id = $1', [toInt(which)]))[0];
      if (!g) return fail(res, 404, 'We could not find that group.');
      ids = [g.id];
    }
    const before = toInt(req.query.before);
    const rows = await q(`${POST_SELECT} WHERE p.hidden = FALSE AND p.group_id IN (${idList(ids)})
      ${before ? `AND p.id < ${before}` : ''} ORDER BY p.id DESC LIMIT 40`);
    const reported = await myReports(me.id, 'post');
    res.json({ posts: await shapePosts(rows.filter((r) => !reported.has(r.id)), me), more: rows.length === 40 });
  }, true));

  app.post('/api/app/posts', wrap(async (req, res, me) => {
    const b = req.body || {};
    const body = clean(b.body, 5000);
    const title = clean(b.title, 300).replace(/\n/g, ' ');
    const type = POST_TYPES.includes(b.type) ? b.type : 'general';
    const gid = toInt(b.group_id);
    if (!body) return fail(res, 400, 'Please write something before you post.');
    if (body.length > 2000) return fail(res, 400, 'Posts can be up to 2000 characters. Please shorten yours a little.');
    if (title.length > 120) return fail(res, 400, 'Titles can be up to 120 characters.');
    if (!(await myGroupIds(me.id)).includes(gid)) return fail(res, 403, 'Please join this group before you post in it.');
    if (isNew(me) && LINK_RE.test(`${title} ${body}`)) {
      return fail(res, 403, 'New members can share links after their first 24 hours. Please remove the link and try again.');
    }
    const recent = await q('SELECT id FROM app_posts WHERE member_id = $1 AND created_at > $2', [me.id, hourAgo()]);
    if (recent.length >= 10) return fail(res, 429, 'You have reached the limit of 10 posts per hour. Please try again a little later.');
    const ins = (await q('INSERT INTO app_posts (group_id, member_id, type, title, body) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [gid, me.id, type, title, body]))[0];
    const rows = await q(`${POST_SELECT} WHERE p.id = $1`, [ins.id]);
    res.status(201).json({ post: (await shapePosts(rows, me))[0] });
  }, true));

  app.get('/api/app/posts/:id', wrap(async (req, res, me) => {
    const rows = await q(`${POST_SELECT} WHERE p.id = $1 AND p.hidden = FALSE`, [toInt(req.params.id)]);
    if (!rows.length) return fail(res, 404, 'This post is no longer available.');
    const reported = await myReports(me.id, 'reply');
    const replies = await q(`SELECT r.id, r.member_id, r.body, r.created_at, m.first_name, m.last_initial, m.is_staff
      FROM app_replies r JOIN app_members m ON m.id = r.member_id
      WHERE r.post_id = $1 AND r.hidden = FALSE ORDER BY r.id ASC`, [rows[0].id]);
    res.json({
      post: (await shapePosts(rows, me))[0],
      replies: replies.filter((r) => !reported.has(r.id)).map((r) => ({
        id: r.id, body: r.body, created_at: r.created_at, mine: r.member_id === me.id,
        author: { name: displayName(r), is_staff: r.is_staff }
      }))
    });
  }, true));

  app.delete('/api/app/posts/:id', wrap(async (req, res, me) => {
    const p = (await q('SELECT id FROM app_posts WHERE id = $1 AND member_id = $2', [toInt(req.params.id), me.id]))[0];
    if (!p) return fail(res, 404, 'We could not find that post.');
    await q('DELETE FROM app_hearts WHERE post_id = $1', [p.id]);
    await q('DELETE FROM app_replies WHERE post_id = $1', [p.id]);
    await q('DELETE FROM app_posts WHERE id = $1', [p.id]);
    res.json({ ok: true });
  }, true));

  app.post('/api/app/posts/:id/replies', wrap(async (req, res, me) => {
    const body = clean((req.body || {}).body, 5000);
    const p = (await q('SELECT id FROM app_posts WHERE id = $1 AND hidden = FALSE', [toInt(req.params.id)]))[0];
    if (!p) return fail(res, 404, 'This post is no longer available.');
    if (!body) return fail(res, 400, 'Please write a reply first.');
    if (body.length > 2000) return fail(res, 400, 'Replies can be up to 2000 characters.');
    if (isNew(me) && LINK_RE.test(body)) {
      return fail(res, 403, 'New members can share links after their first 24 hours. Please remove the link and try again.');
    }
    const recent = await q('SELECT id FROM app_replies WHERE member_id = $1 AND created_at > $2', [me.id, hourAgo()]);
    if (recent.length >= 30) return fail(res, 429, 'You have replied a lot this hour. Please try again a little later.');
    const r = (await q('INSERT INTO app_replies (post_id, member_id, body) VALUES ($1,$2,$3) RETURNING id, body, created_at',
      [p.id, me.id, body]))[0];
    res.status(201).json({ reply: { id: r.id, body: r.body, created_at: r.created_at, mine: true, author: { name: displayName(me), is_staff: me.is_staff } } });
  }, true));

  app.delete('/api/app/replies/:id', wrap(async (req, res, me) => {
    await q('DELETE FROM app_replies WHERE id = $1 AND member_id = $2', [toInt(req.params.id), me.id]);
    res.json({ ok: true });
  }, true));

  app.post('/api/app/posts/:id/heart', wrap(async (req, res, me) => {
    const p = (await q('SELECT id FROM app_posts WHERE id = $1 AND hidden = FALSE', [toInt(req.params.id)]))[0];
    if (!p) return fail(res, 404, 'This post is no longer available.');
    const has = await q('SELECT id FROM app_hearts WHERE post_id = $1 AND member_id = $2', [p.id, me.id]);
    if (has.length) await q('DELETE FROM app_hearts WHERE post_id = $1 AND member_id = $2', [p.id, me.id]);
    else await q('INSERT INTO app_hearts (post_id, member_id) VALUES ($1,$2)', [p.id, me.id]);
    const n = await q('SELECT id FROM app_hearts WHERE post_id = $1', [p.id]);
    res.json({ hearted: !has.length, hearts: n.length });
  }, true));

  app.post('/api/app/report', wrap(async (req, res, me) => {
    const b = req.body || {};
    const type = b.target_type === 'reply' ? 'reply' : b.target_type === 'post' ? 'post' : '';
    const table = type === 'post' ? 'app_posts' : 'app_replies';
    const id = toInt(b.target_id);
    if (!type) return fail(res, 400, 'Please choose what you are reporting.');
    const target = (await q(`SELECT id, member_id FROM ${table} WHERE id = $1`, [id]))[0];
    if (!target) return fail(res, 404, 'That item is no longer available.');
    if (target.member_id === me.id) return fail(res, 400, 'You can delete your own posts instead of reporting them.');
    const reason = REPORT_REASONS.includes(b.reason) ? b.reason : 'other';
    const has = await q('SELECT id FROM app_reports WHERE target_type = $1 AND target_id = $2 AND member_id = $3', [type, id, me.id]);
    if (!has.length) {
      await q('INSERT INTO app_reports (target_type, target_id, member_id, reason, note) VALUES ($1,$2,$3,$4,$5)',
        [type, id, me.id, reason, clean(b.note, 500)]);
    }
    const n = await q('SELECT id FROM app_reports WHERE target_type = $1 AND target_id = $2', [type, id]);
    // Staff welcome posts stay visible; reports on them are still stored for review.
    const author = (await q('SELECT is_staff FROM app_members WHERE id = $1', [target.member_id]))[0];
    if (n.length >= HIDE_AT && !(author && author.is_staff)) await q(`UPDATE ${table} SET hidden = TRUE WHERE id = $1`, [id]);
    res.json({ ok: true });
  }, true));

  // ---------- events ----------
  app.get('/api/app/events', wrap(async (req, res) => {
    let events = [];
    try {
      events = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'events.json'), 'utf8'));
    } catch (e) { events = []; }
    if (!Array.isArray(events)) events = [];
    events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    res.json({ events });
  }));
};
