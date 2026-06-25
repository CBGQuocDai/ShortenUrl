#!/usr/bin/env bash
# threshold/run.sh — runs the three threshold sweeps and writes the report.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-http://localhost:8080/api}"
DB_URL="${DB_URL:-postgresql://postgres:12345@localhost:5432/shorten_url}"
RUN_ID="$(date +%Y-%m-%dT%H-%M-%S)"
OUT_DIR="threshold-results/${RUN_ID}"
mkdir -p "${OUT_DIR}"

export BASE_URL DB_URL OUT_DIR

echo "===================================================="
echo "  Threshold Sweep — ${RUN_ID}"
echo "  Output: ${OUT_DIR}"
echo "===================================================="

# Login.
echo "[1/3] login..."
BENCH_TOKEN="$(BASE_URL="${BASE_URL}" node lib/login.js)"
export BENCH_TOKEN
echo "      ✓ token len=${#BENCH_TOKEN}"

# Health.
curl -fsS "${BASE_URL}/actuator/health" >/dev/null || { echo "backend down"; exit 1; }

# Default ranges — tuned per path:
#   read:  starts at 500 (we already saw ~2400 rps is fine)
#   write: starts at 200 (writes heavier)
#   mixed: starts at 200
# Override via env: READ_START, READ_END, READ_STEP, etc.

echo "[2/3] running read sweep..."
OUT_DIR="${OUT_DIR}" node scenarios/threshold-read.js \
  --start "${READ_START:-500}" --end "${READ_END:-6000}" --step "${READ_STEP:-500}" \
  --duration "${STEP_DURATION:-20}" --workers "${WORKERS:-64}"

echo "[2/3] running write sweep..."
OUT_DIR="${OUT_DIR}" node scenarios/threshold-write.js \
  --start "${WRITE_START:-200}" --end "${WRITE_END:-3500}" --step "${WRITE_STEP:-300}" \
  --duration "${STEP_DURATION:-20}" --workers "${WORKERS:-128}"

echo "[2/3] running mixed sweep..."
OUT_DIR="${OUT_DIR}" node scenarios/threshold-mixed.js \
  --start "${MIXED_START:-200}" --end "${MIXED_END:-3500}" --step "${MIXED_STEP:-300}" \
  --duration "${STEP_DURATION:-20}" --workers "${WORKERS:-128}" --read-ratio 0.8

echo "[3/3] writing report..."
node lib/threshold-reporter.js "${OUT_DIR}" "${OUT_DIR}"
echo ""
echo "Done. Open: ${OUT_DIR}/threshold-report.md"
