#!/bin/bash
# THE BENCH RUNS (0.6.8): one drawn seed, printed first. Five sandbox runs on
# the town, five on the wall-ringed town, one allocation run, three runs in
# the real war with its first assault afield; then three browser runs on the
# town, on the Pi's own display; then the page and its check. A rerun passes
# the drawn seed back: bash all.sh <seed>.
set -e
ROOT=/home/batman/coldsnap
OUT=$ROOT/docs/superpowers/perf/davy
SEED=${1:-$(node -e 'console.log(Math.floor(Math.random()*1000000)+1)')}
echo "seed $SEED"
cd "$ROOT"
for K in 1 2 3 4 5; do
  node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --label base$K
  node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target walls --label base$K
done
node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --label alloc --alloc
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode war --target town --label war$K; done
TX=$(node -e "console.log(require('$OUT/base1-sandbox-town.json').tx)")
TZ=$(node -e "console.log(require('$OUT/base1-sandbox-town.json').tz)")
npm run build
pkill -f "[v]ite preview" || true; sleep 1
( npm run preview -- --strictPort --port 4173 >/tmp/davy-preview.log 2>&1 & )
curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null
for K in 1 2 3; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --tx "$TX" --tz "$TZ" --label base$K; done
pkill -f "[v]ite preview" || true
node "$OUT/page.mjs"
node "$OUT/check.mjs"
echo "ALL DONE seed $SEED"
