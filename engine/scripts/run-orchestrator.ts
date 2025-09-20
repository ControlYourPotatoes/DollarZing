import { resolve } from "path";
import {
  createDefaultOrchestratorConfig,
} from "../cli/src/orchestrator/core/config";
import {
  DatasetOrchestrator,
  type ParameterMappingConfig,
  type DatasetProgressCallback,
} from "../cli/src/orchestrator/execution/dataset-orchestrator";
import {
  generateAllCombinations,
  generateDirectoryName,
} from "../cli/src/orchestrator/parameters/matrix";
import type { ParameterCombination } from "../cli/src/orchestrator/core/types";
import { displayConfiguration } from "../cli/src/orchestrator/cli/cli";
import { EventBus } from "../src/index";

interface RunnerOptions {
  outputDirectory: string;
  collectSnapshots: boolean;
  collectEvents: boolean;
  collectPresentation: boolean;
  verbose: boolean;
  days?: number;
  combination?: ParameterCombination;
}

function parseArgs(argv: string[]): RunnerOptions {
  const args = new Set(argv);
  const outputIndex = argv.findIndex((arg) => arg === "--output" || arg === "-o");
  const outputDirectory =
    outputIndex !== -1 && argv[outputIndex + 1]
      ? argv[outputIndex + 1]
      : "engine/generated-datasets";

  const daysIndex = argv.findIndex((arg) => arg === "--days");
  const days =
    daysIndex !== -1 && argv[daysIndex + 1]
      ? Number.parseInt(argv[daysIndex + 1], 10)
      : undefined;

  const comboIndex = argv.findIndex(
    (arg) => arg === "--combo" || arg === "--combination"
  );
  let combination: ParameterCombination | undefined;
  if (comboIndex !== -1 && argv[comboIndex + 1]) {
    combination = parseCombination(argv[comboIndex + 1]);
  }

  const options: RunnerOptions = {
    outputDirectory,
    collectSnapshots: !args.has("--no-snapshots"),
    collectEvents: !args.has("--no-events"),
    collectPresentation: !args.has("--no-presentation"),
    verbose: args.has("--verbose"),
  };

  if (days !== undefined && !Number.isNaN(days)) {
    options.days = days;
  }

  if (combination) {
    options.combination = combination;
  }

  return options;
}

function parseCombination(input: string): ParameterCombination {
  const normalized = input.replace(/\s+/g, "");
  const parts = normalized.includes(",")
    ? normalized.split(",")
    : normalized.split("-");

  if (parts.length !== 3) {
    throw new Error(
      "Combination must be in the form growth,risk,charity (e.g. 15,low,10)"
    );
  }

  const [growthRaw, riskRaw, charityRaw] = parts;
  const growth = Number.parseInt(growthRaw, 10);
  const charity = Number.parseInt(charityRaw, 10);
  const risk = riskRaw as ParameterCombination["riskLevel"];

  if (![15, 35, 60].includes(growth)) {
    throw new Error("Growth rate must be 15, 35, or 60");
  }
  if (!["low", "mid", "high"].includes(risk)) {
    throw new Error("Risk level must be low, mid, or high");
  }
  if (![10, 20, 30].includes(charity)) {
    throw new Error("Charity percentage must be 10, 20, or 30");
  }

  return {
    growthRate: growth as ParameterCombination["growthRate"],
    riskLevel: risk,
    charityPercentage: charity as ParameterCombination["charityPercentage"],
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`Usage: ts-node --esm scripts/run-orchestrator.ts [options]\n\nOptions:\n  -o, --output <dir>        Output directory (default: engine/generated-datasets)\n      --days <n>            Override simulation length in days (e.g. 90)\n      --combo <g,r,c>       Run a single combination (e.g. 15,low,10)\n      --no-snapshots        Skip writing daily snapshot aggregates\n      --no-events           Skip writing event trace logs\n      --no-presentation     Skip writing presentation snapshots\n      --verbose             Enable verbose logging\n      --help                Show this help message\n`);
    process.exit(0);
  }

  const options = parseArgs(argv);

  const orchestratorConfig = createDefaultOrchestratorConfig({
    outputDirectory: options.outputDirectory,
    verbose: options.verbose,
    collectDailySnapshots: options.collectSnapshots,
    collectEventTraces: options.collectEvents,
    collectPresentationSnapshots: options.collectPresentation,
  });

  if (options.verbose) {
    displayConfiguration(orchestratorConfig);
  }

  const mappingOverrides: Partial<ParameterMappingConfig> = {};
  if (options.days && options.days > 0) {
    mappingOverrides.baseSimulationDays = options.days;
  }

  const eventBus = new EventBus();
  const orchestrator = new DatasetOrchestrator(
    orchestratorConfig,
    mappingOverrides,
    eventBus
  );

  const combinations = options.combination
    ? [options.combination]
    : generateAllCombinations();

  const total = combinations.length;
  const start = performance.now();
  let successful = 0;
  const failures: Array<{ combination: ParameterCombination; error?: string }> = [];

  console.log(
    `🚀 Generating ${
      options.combination ? "single combination" : `${total} combinations`
    } (${mappingOverrides.baseSimulationDays ?? 365}-day span)`
  );

  let index = 0;
  for (const combination of combinations) {
    index += 1;
    const label = generateDirectoryName(combination);
    console.log(`\n▶ ${index}/${total} ${label}`);

    const result = await orchestrator.generateDataset(
      combination,
      createProgressPrinter(label)
    );
    process.stdout.write("\n");

    if (result.success && result.simulationResults) {
      successful += 1;
      if (options.verbose) {
        console.log(
          `  ✓ Completed in ${result.generationTimeMs.toFixed(0)}ms`);
      }
    } else {
      const failure: { combination: ParameterCombination; error?: string } = {
        combination,
      };
      if (result.error) {
        failure.error = result.error;
      }
      failures.push(failure);
      console.warn(
        `  ⚠ Failed${result.error ? `: ${result.error}` : ''}`
      );
    }
  }

  const duration = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Finished ${successful}/${total} combinations in ${duration}s`);
  console.log(`Output directory: ${resolve(orchestratorConfig.outputDirectory)}`);

  if (failures.length > 0) {
    console.warn("\n⚠ Failures:");
    failures.forEach(({ combination, error }) => {
      console.warn(
        `  - ${generateDirectoryName(combination)}${
          error ? `: ${error}` : ''
        }`
      );
    });
    process.exitCode = 1;
  }
}

function createProgressPrinter(label: string): DatasetProgressCallback {
  return (_combination, progress) => {
    const percent = ((progress.currentDay / progress.totalDays) * 100).toFixed(1);
    process.stdout.write(
      `    ${label}: day ${progress.currentDay}/${progress.totalDays} (${percent}%)\r`
    );
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Orchestrator run failed:", error);
    process.exit(1);
  });
}
