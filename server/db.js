// Postgres in production (DATABASE_URL); in-memory emulator otherwise so the site still runs.
const url = process.env.DATABASE_URL;
let pool;
if (url) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: url, ssl: /render\.com/.test(url) ? { rejectUnauthorized: false } : undefined });
} else {
  const { newDb } = require('pg-mem');
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  pool = new Pool();
}
module.exports = { query: (text, params) => pool.query(text, params), persistent: !!url };
