// lib/sink.js — dual sink: push into in-memory array AND append-line to NDJSON.
// NDJSON is line-delimited JSON, one record per request.
// Compact format: {"s":<status>,"t":<latencyMs>,"k":<kind>,"ts":<epochMs>}

const fs = require('fs');

function openNdjson(filePath) {
  fs.mkdirSync(require('path').dirname(filePath), { recursive: true });
  return fs.openSync(filePath, 'w');
}

function makeSink({ ndjsonFd, samples, kind }) {
  return (status, latencyMs, ts) => {
    // In-memory sample (for stats).
    samples.push({ status, latencyMs, ts, kind });
    // NDJSON line (for tail analysis).
    fs.writeSync(ndjsonFd, JSON.stringify({ s: status, t: latencyMs, k: kind, ts }) + '\n');
  };
}

module.exports = { openNdjson, makeSink };
