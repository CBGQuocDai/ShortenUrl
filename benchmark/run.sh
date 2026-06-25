#!/usr/bin/env bash
# benchmark/run.sh — one-shot benchmark orchestrator.
# Health check → login → matrix of scenarios → report.
set -euo pipefail

cd "$(dirname "$0")"

BASE_URL="${BASE_URL:-http://localhost:8080/api}"
DB_URL="${DB_URL:-postgresql://postgres:12345@localhost:5432/shorten_url}"
WARMUP_SEC="${WARMUP_SEC:-5}"
DURATION_SEC="${DURATION_SEC:-30}"

export BASE_URL DB_URL WARMUP_SEC DURATION_SEC

RUN_ID="$(date +%Y-%m-%dT%H-%M-%S)"
OUT_DIR="results/${RUN_ID}"
PER_DIR="${OUT_DIR}/per-scenario"
mkdir -p "${PER_DIR}"

# Concurrency matrix.
READ_LEVELS=(10 50 100 200 500)
WRITE_LEVELS=(10 50 100 200)
MIXED_LEVELS=(50 100 200)

echo "===================================================="
echo "  Benchmark — ${RUN_ID}"
echo "  Backend: ${BASE_URL}"
echo "  Output:  ${OUT_DIR}"
echo "===================================================="

# 1. health check
echo "[1/4] health check..."
HEALTH="$(curl -fsS "${BASE_URL}/actuator/health" || echo 'FAIL')"
if [[ "${HEALTH}" == "FAIL" ]]; then
  echo "backend not healthy at ${BASE_URL}/actuator/health"
  exit 1
fi
echo "      ✓ ${HEALTH}"

# 2. login → token file
echo "[2/4] login as ${BENCH_USER:-benchuser01}..."
BENCH_TOKEN="$(BASE_URL="${BASE_URL}" node lib/login.js)"
export BENCH_TOKEN
echo "      ✓ token len=${#BENCH_TOKEN}"

# 3. write meta.json
BRANCH="$(git -C .. rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
READ_ARR="[$(IFS=,; echo "${READ_LEVELS[*]}")]"
WRITE_ARR="[$(IFS=,; echo "${WRITE_LEVELS[*]}")]"
MIXED_ARR="[$(IFS=,; echo "${MIXED_LEVELS[*]}")]"
node -e "
const m = {
  runId: '${RUN_ID}',
  startedAt: new Date().toISOString(),
  baseUrl: '${BASE_URL}',
  dbUrl: '${DB_URL}',
  branch: '${BRANCH}',
  warmupSec: ${WARMUP_SEC},
  durationSec: ${DURATION_SEC},
  matrix: { read: ${READ_ARR}, write: ${WRITE_ARR}, mixed: ${MIXED_ARR} }
};
require('fs').writeFileSync('${OUT_DIR}/meta.json', JSON.stringify(m, null, 2));
"

# 4. run scenarios
echo "[3/4] running scenarios..."

run_scenario() {
  local kind="$1"; local c="$2"
  OUT_DIR="${OUT_DIR}" BENCH_TOKEN="${BENCH_TOKEN}" \
    node "scenarios/${kind}.js" --concurrency "${c}" --duration "${DURATION_SEC}" --warmup "${WARMUP_SEC}"
}

TOTAL=$((${#READ_LEVELS[@]} + ${#WRITE_LEVELS[@]} + ${#MIXED_LEVELS[@]}))
DONE=0
for c in "${READ_LEVELS[@]}"; do
  DONE=$((DONE+1)); echo "  [${DONE}/${TOTAL}] read @ c=${c}";   run_scenario read-only  "${c}"
done
for c in "${WRITE_LEVELS[@]}"; do
  DONE=$((DONE+1)); echo "  [${DONE}/${TOTAL}] write @ c=${c}";  run_scenario write-only "${c}"
done
for c in "${MIXED_LEVELS[@]}"; do
  DONE=$((DONE+1)); echo "  [${DONE}/${TOTAL}] mixed @ c=${c}";  run_scenario mixed      "${c}"
done

# 5. report
echo "[4/4] writing report..."
node lib/reporter.js "${OUT_DIR}"
echo ""
echo "Done. Open: ${OUT_DIR}/summary.md"
