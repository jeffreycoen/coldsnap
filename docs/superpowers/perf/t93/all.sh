#!/bin/bash
# THE SIX RUNS: one drawn seed, printed first; base then the five changes,
# one preview server and one browser each, in order; then the page and its
# check. A rerun passes the drawn seed back: bash all.sh <seed>.
ROOT=/home/batman/coldsnap-t93
OUT=/home/batman/coldsnap/docs/superpowers/perf/t93
SEED=${1:-$(node -e 'console.log(Math.floor(Math.random()*100000))')}
echo "seed $SEED"
for NAME in base c1 c2 c3 c4 c5; do
  pkill -f "[v]ite preview"; sleep 1
  ( cd "$ROOT/$NAME" && npm run preview -- --strictPort --port 4173 >"/tmp/t93-preview-$NAME.log" 2>&1 & )
  if ! curl -sf --retry 30 --retry-delay 1 --retry-all-errors http://localhost:4173/coldsnap/ -o /dev/null; then echo "SERVER DOWN $NAME"; pkill -f "[v]ite preview"; exit 1; fi
  echo "server up $NAME"
  if ! node "$OUT/run.mjs" "$NAME" "$SEED"; then echo "RUN FAILED $NAME"; pkill -f "[v]ite preview"; exit 1; fi
  pkill -f "[v]ite preview"; sleep 1
done
node "$OUT/page.mjs" || { echo "PAGE FAILED (identity or build)"; exit 1; }
node "$OUT/check.mjs" || { echo "PAGE CHECK FAILED"; exit 1; }
echo "ALL DONE seed $SEED"
