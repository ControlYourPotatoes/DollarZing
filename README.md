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

The direct ts-node invocation still tries to resolve bare imports (like ../cli/src/orchestrator/...) the way plain Node does, so you’ll keep hitting “Cannot find module …” unless you supply Node-style specifier resolution.

Two easy ways to get the 90-day, first-anchor run:

Use the bundled JS (recommended)

cd engine
npm run build
node dist/scripts/run-orchestrator.js --days 90 --combo 15,low,10
That executes the compiled runner, writes the 90‑day dataset + snapshots/events to engine/generated-datasets/....

If you want to stay in TypeScript

cd engine
npx ts-node --esm --experimentalSpecifierResolution=node \
 scripts/run-orchestrator.ts --days 90 --combo 15,low,10
The extra --experimentalSpecifierResolution=node flag lets ts-node resolve those ../cli/src/... imports the way our build step does.

Either approach will produce the shorter 3‑month dataset for the first matrix combination.

node dist/scripts/run-orchestrator.js --days 90 --combo 15,low,10 --no-events

node dist/scripts/run-orchestrator.js --days 365 --no-events

NODE_OPTIONS="--max-old-space-size=9126" node dist/scripts/run-orchestrator.js --days 365 --no-events --combo 60,mid,10

npm run simulate -- --days 1 2>&1 | tee sim.log


  NODE_OPTIONS="--max-old-space-size=9126" \
    node dist/scripts/run-orchestrator.js \
    --days 5 \
    --combo 15,high,10 \
    --debug-events \
    --log-file engine/run.log

Lowbase high risk
node dist/scripts/run-orchestrator.js --days 90 --combo 15,high,10 --log-file run.log
Mid growth High risk
node dist/scripts/run-orchestrator.js --days 30 --combo 35,high,10 --log-file run.log


cd /workspace/engine && timeout 15s node dist/scripts/run-orchestrator.js --days 1 --combo 35,high,10 2>/dev/null | grep -E "(warn|progression)" | head -10