// lib/login.js — ensure benchmark user exists, then fetch a JWT once.
// Prints the raw token to stdout.

const { request } = require('./http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/api';
const USER = process.env.BENCH_USER || 'benchuser01';
const PASS = process.env.BENCH_PASS || 'Bench@Pass1';

async function ensureUser() {
  // Try register; ignore 400 (already exists).
  const reg = await request({
    method: 'POST',
    baseUrl: BASE_URL,
    path: '/auth/register',
    body: { username: USER, password: PASS },
  });
  if (reg.status === 200) return 'registered';
  if (reg.status === 400 && /existed/i.test(reg.body)) return 'exists';
  // Any other failure: bail.
  return null;
}

(async () => {
  const ensured = await ensureUser();
  if (ensured === null) {
    console.error('[login] could not register benchmark user');
    process.exit(1);
  }
  const res = await request({
    method: 'POST',
    baseUrl: BASE_URL,
    path: '/auth/login',
    body: { username: USER, password: PASS },
  });
  if (res.status !== 200 || !res.json || !res.json.data || !res.json.data.token) {
    console.error('[login] FAILED', res.status, res.body);
    process.exit(1);
  }
  process.stdout.write(res.json.data.token);
})();
