#!/bin/bash
# THE BENCH RUNS, FOURTH SET (0.6.11): one drawn seed, printed first, and a
# label prefix. Three sandbox runs on the town with a second burst fifteen
# seconds after the first, one on the wall-ringed town, three in the real war
# with the lists hot and its first assault afield, then the lofted round —
# aloft four seconds — twice in the sandbox and once in the war; then two
# browser runs in the sandbox and two in the real war on the Pi's own
# display, each reading the quiet seconds before the burst; then the page and
# its check. A rerun passes the drawn seed back: bash all.sh <seed> [prefix].
# Without a prefix the sandbox runs are labelled q and the war runs w, as the
# second set was; a twin run on the second set's seed passes its own prefix,
# so its records land beside the base's in the page's groups and the page
# compares them.
set -e
ROOT=/home/batman/coldsnap
OUT=$ROOT/docs/superpowers/perf/davy
SEED=${1:-$(node -e 'console.log(Math.floor(Math.random()*1000000)+1)')}
P=${2:-}
QL=${P:-q}; WL=${P:-w}
echo "seed $SEED labels $QL $WL"
cd "$ROOT"
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --second 15 --label $QL$K; done
node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target walls --second 15 --label ${QL}1
for K in 1 2 3; do node scripts/diag-davy.mjs --seed "$SEED" --mode war --target town --hot --second 15 --label $WL$K; done
for K in 1 2; do node scripts/diag-davy.mjs --seed "$SEED" --mode sandbox --target town --loft 4 --label $QL$K; done
node scripts/diag-davy.mjs --seed "$SEED" --mode war --target town --hot --loft 4 --label ${WL}1
TX=$(node -e "console.log(require('$OUT/${QL}1-sandbox-town.json').tx)")
TZ=$(node -e "console.log(require('$OUT/${QL}1-sandbox-town.json').tz)")
npm run build
pkill -f "[v]ite preview" || true; sleep 1
( npm run preview -- --strictPort --port 4173 >/tmp/davy-preview.log 2>&1 & )
curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --mode sandbox --tx "$TX" --tz "$TZ" --label $QL$K; done
for K in 1 2; do DISPLAY=:0 node scripts/diag-davy-browser.mjs --seed "$SEED" --mode war --tx "$TX" --tz "$TZ" --label $WL$K; done
pkill -f "[v]ite preview" || true
node "$OUT/page.mjs"
node "$OUT/check.mjs"
echo "ALL DONE seed $SEED"
