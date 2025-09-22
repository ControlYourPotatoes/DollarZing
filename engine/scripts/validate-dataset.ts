import { promises as fs } from "fs";
import { resolve, join, basename } from "path";

interface ValidationResult {
  name: string;
  passed: boolean;
  details?: string;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function findLatestScenarioDir(baseDir: string): Promise<string> {
  const root = resolve(baseDir);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 0) throw new Error(`No scenarios in ${root}`);
  const stats = await Promise.all(
    dirs.map(async (d) => ({
      name: d.name,
      mtimeMs: (await fs.stat(join(root, d.name))).mtimeMs,
    }))
  );
  stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return join(root, stats[0].name);
}

async function validateScenario(dir: string): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  const datasetPath = join(dir, "dataset.json");
  const snapshotsPath = join(dir, "presentation-snapshots.json");

  // Load dataset.json
  const dataset = await readJson<any>(datasetPath);
  const revenueStats = dataset?.revenueStats ?? {};
  const gameStats = dataset?.gameStats ?? {};

  // Donation consistency: totalCharity ≈ totalCashOuts × charityPercentage
  if (
    typeof revenueStats.totalCharityContributions === "number" &&
    typeof revenueStats.totalCashOuts === "number" &&
    typeof revenueStats.charityPercentage === "number"
  ) {
    const expected =
      revenueStats.totalCashOuts * revenueStats.charityPercentage;
    const actual = revenueStats.totalCharityContributions;
    const delta = Math.abs(expected - actual);
    results.push({
      name: "Donations equal cashouts × rate (cumulative)",
      passed: delta <= 0.02, // small rounding leeway
      details: `expected=${expected.toFixed(2)} actual=${actual.toFixed(
        2
      )} delta=${delta.toFixed(4)}`,
    });
  } else {
    results.push({
      name: "Donations equal cashouts × rate (cumulative)",
      passed: false,
      details: "Missing revenueStats fields",
    });
  }

  // Load snapshots if present and validate pool accounting
  try {
    const snapshots = await readJson<any[]>(snapshotsPath);
    let poolChecks = 0;
    let poolFailures = 0;
    for (const snap of snapshots) {
      const gamesPlayed = snap?.totals?.gamesPlayed;
      const consumed = snap?.pool?.consumedToday;
      if (typeof gamesPlayed === "number" && typeof consumed === "number") {
        poolChecks += 1;
        const expectedConsumed = gamesPlayed * 2;
        if (Math.abs(expectedConsumed - consumed) > 1e-9) {
          poolFailures += 1;
        }
      }
    }
    results.push({
      name: "Pool consumedToday equals gamesPlayed × 2 (all days)",
      passed: poolChecks > 0 && poolFailures === 0,
      details: `daysChecked=${poolChecks} failures=${poolFailures}`,
    });
  } catch (e) {
    results.push({
      name: "Pool consumedToday equals gamesPlayed × 2 (all days)",
      passed: false,
      details: "presentation-snapshots.json missing or unreadable",
    });
  }

  // Basic existence checks
  results.push({
    name: "Has revenueStats.totalCashOuts and cashOutCount",
    passed:
      typeof revenueStats.totalCashOuts === "number" &&
      typeof revenueStats.cashOutCount === "number",
  });
  results.push({
    name: "Has totalGames in dataset",
    passed: typeof gameStats.totalGames === "number",
  });

  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  const dirFlagIndex = argv.findIndex((a) => a === "--dir");
  const outputFlagIndex = argv.findIndex((a) => a === "--output");

  const outputRoot = resolve(
    outputFlagIndex !== -1 && argv[outputFlagIndex + 1]
      ? argv[outputFlagIndex + 1]
      : "engine/generated-datasets/anchor-datasets"
  );

  const scenarioDir = resolve(
    dirFlagIndex !== -1 && argv[dirFlagIndex + 1]
      ? argv[dirFlagIndex + 1]
      : await findLatestScenarioDir(outputRoot)
  );

  const name = basename(scenarioDir);
  console.log(`Validating scenario: ${name}`);
  const results = await validateScenario(scenarioDir);
  let failures = 0;
  for (const r of results) {
    const status = r.passed ? "✓" : "✗";
    console.log(`${status} ${r.name}${r.details ? ` — ${r.details}` : ""}`);
    if (!r.passed) failures += 1;
  }
  if (failures > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Validation failed:", err);
    process.exit(1);
  });
}
