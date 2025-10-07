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
node dist/scripts/run-orchestrator.js --days 10 --combo 15,high,10 --no-events --log-file run.log
Mid growth High risk
node dist/scripts/run-orchestrator.js --days 15 --combo 60,high,20 --no-events --log-file run2.log


cd /workspace/engine && timeout 15s node dist/scripts/run-orchestrator.js --days 1 --combo 35,high,10 2>/dev/null | grep -E "(warn|progression)" | head -10


Day 10’s spike matches a cascade of POOL_ADDED events where the pool grew 6➜281➜5645 while resolvedGames stayed flat at 6566. That means new runs kept entering, but completed games weren’t being tallied during the stabilization window, so waitForEventProcessing kept resetting and the backlog ballooned. By 20:52 logs the pool was already 3169 with availableForMatching = −1526, showing the matching engine believed more dollars were reserved than present—exactly the equilibrium break you’re chasing. Root suspects:

PlayerManager injected the full new-player cohort after Day 9’s timeout, dumping hundreds of fresh dollars into the pool at once.
Matchmaking emitted back-to-back POOL_REMOVED/POOL_UPDATED without corresponding GAME_RESOLVED, so active game counts rose (0→3304) but never drained before the timeout.
The negative “availableForMatching” implies the pool accounting isn’t decremented when games finish, so dollars pile up virtually.
Focus on the DayEnded flow: verify that every POOL_REMOVED on “MATCHED_FOR_GAME” is paired with either a GAME_RESOLVED or POOL_ADDED reuse, and audit GameMatchingEngine bookkeeping so availableForMatching never dips below zero.