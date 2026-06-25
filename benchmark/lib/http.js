// lib/http.js — minimal HTTP client with per-request timing
// Mirrors backend/seed.js style. Never throws on non-2xx; returns status:0 on network failure.

const http = require('http');

function request({ method = 'GET', baseUrl, path, body = null, token = null, timeoutMs = 30000 }) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl + path);
    const payload = body == null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
    const headers = {
      'Content-Length': payload.length,
      'User-Agent': 'shorten-url-benchmark/1.0',
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const t0 = process.hrtime.bigint();
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        let buf = '';
        let bytes = 0;
        res.setEncoding('utf8');
        res.on('data', (c) => {
          bytes += c.length;
          if (buf.length < 1024) buf += c;
        });
        res.on('end', () => {
          const t1 = process.hrtime.bigint();
          const latencyMs = Number(t1 - t0) / 1e6;
          let parsed = null;
          if (buf) {
            try { parsed = JSON.parse(buf); } catch { parsed = null; }
          }
          resolve({ status: res.statusCode, latencyMs, body: buf, json: parsed, bytes });
        });
      }
    );
    req.on('error', (err) => {
      const t1 = process.hrtime.bigint();
      const latencyMs = Number(t1 - t0) / 1e6;
      resolve({ status: 0, latencyMs, body: '', json: null, bytes: 0, error: err.message });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
    if (payload.length > 0) req.write(payload);
    req.end();
  });
}

module.exports = { request };
