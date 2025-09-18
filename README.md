cd engine
node dist/cli/src/index.js simulate --days 7 --debug-dashboard

cd engine
node dist/cli/src/index.js simulate \
  --profile development \
  --days 20 \
  --players 10 \
  --dollars-per-player 1 \
  --charity 20 \
  --strategies aggressive=1 \
  --debug-dashboard