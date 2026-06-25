// lib/pg-client.js — sample short codes for read scenarios.
// Uses PostgreSQL TABLESAMPLE for an unbiased random sample.

const { Client } = require('pg');

const DB_URL = process.env.DB_URL || 'postgresql://postgres:12345@localhost:5432/shorten_url';

async function sampleShortCodes(n = 1000) {
  const client = new Client({ connectionString: DB_URL, statement_timeout: 10000 });
  await client.connect();
  try {
    const r = await client.query(
      `SELECT short_code FROM shorten_url TABLESAMPLE BERNOULLI(0.01) LIMIT $1`,
      [n]
    );
    return r.rows.map((row) => row.short_code);
  } finally {
    await client.end();
  }
}

module.exports = { sampleShortCodes };
