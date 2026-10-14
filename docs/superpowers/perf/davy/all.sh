#!/bin/bash
# THE BENCH RUNS, SECOND SET (0.6.9): one drawn seed, printed first. Three
# sandbox runs on the town with a second burst fifteen seconds after the
# first, one on the wall-ringed town, three in the real war with the lists
# hot and its first assault afield; then two browser runs in the sandbox and
# two in the real war on the Pi's own display, each reading the quiet seconds
# before the burst; then the page and its check. A rerun passes the drawn
# seed back: bash all.sh <seed>.
set -e
ROOT=/home/batman/coldsnap
OUT=$ROOT/docs/superpowers/perf/davy
SEED=${1:-$(node -e 'console.log(Math.floor(Math.random()*1000000)+1)')}
echo "seed $SEED"
cd "$ROOT"
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --second 15 --label q$K; done
node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target walls --second 15 --label q1
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode war --target town --hot --second 15 --label w$K; done
TX=$(node -e "console.log(require('$OUT/q1-sandbox-town.json').tx)")
TZ=$(node -e "console.log(require('$OUT/q1-sandbox-town.json').tz)")
npm run build
pkill -f "[v]ite preview" || true; sleep 1
( npm run preview -- --strictPort --port 4173 >/tmp/davy-preview.log 2>&1 & )
curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --mode sandbox --tx "$TX" --tz "$TZ" --label q$K; done
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --mode war --tx "$TX" --tz "$TZ" --label w$K; done
pkill -f "[v]ite preview" || true
node "$OUT/page.mjs"
node "$OUT/check.mjs"
echo "ALL DONE seed $SEED"
