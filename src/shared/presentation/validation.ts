import {
  PresentationSnapshotFile,
  PresentationManifest,
  PresentationManifestEntry,
  PresentationSnapshot,
  PresentationDistributionPoint,
  PresentationAccumulationPoint,
  PresentationWorkflowLayer,
  PresentationWorkflowNode,
  PresentationWorkflowLink,
  PresentationScenarioCoordinates,
} from "./types";

class ValidationError extends Error {}

interface ValidationOptions {
  allowEmptyDays?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertNumber(
  value: unknown,
  message: string
): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(message);
  }
}

function assertString(
  value: unknown,
  message: string
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError(message);
  }
}

function assertArray<T>(value: unknown, message: string): asserts value is T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(message);
  }
}

function validateDistributionPoint(
  point: unknown,
  path: string
): PresentationDistributionPoint {
  if (!isObject(point)) {
    throw new ValidationError(`${path} must be an object`);
  }
  assertString(point.category, `${path}.category must be a string`);
  assertNumber(point.value, `${path}.value must be a number`);
  return {
    category: point.category,
    value: point.value,
  };
}

function validateAccumulationPoint(
  point: unknown,
  path: string
): PresentationAccumulationPoint {
  if (!isObject(point)) {
    throw new ValidationError(`${path} must be an object`);
  }
  assertString(point.metric, `${path}.metric must be a string`);
  assertNumber(point.cumulative, `${path}.cumulative must be a number`);
  return {
    metric: point.metric,
    cumulative: point.cumulative,
  };
}

function validateWorkflowLayer(
  layer: unknown,
  path: string
): PresentationWorkflowLayer {
  if (!isObject(layer)) {
    throw new ValidationError(`${path} must be an object`);
  }
  assertString(layer.id, `${path}.id must be a string`);
  assertString(layer.label, `${path}.label must be a string`);
  assertNumber(layer.value, `${path}.value must be a number`);
  assertString(layer.color, `${path}.color must be a string`);
  return {
    id: layer.id,
    label: layer.label,
    value: layer.value,
    color: layer.color,
  };
}

function validateWorkflowNode(
  node: unknown,
  path: string
): PresentationWorkflowNode {
  if (!isObject(node)) {
    throw new ValidationError(`${path} must be an object`);
  }
  assertString(node.id, `${path}.id must be a string`);
  assertString(node.label, `${path}.label must be a string`);
  assertNumber(node.aggregateValue, `${path}.aggregateValue must be a number`);
  const validated: PresentationWorkflowNode = {
    id: node.id,
    label: node.label,
    aggregateValue: node.aggregateValue,
  };

  if (node.progress !== undefined) {
    assertNumber(
      node.progress,
      `${path}.progress must be a number if provided`
    );
    validated.progress = node.progress;
  }

  if (Array.isArray(node.layers)) {
    validated.layers = node.layers.map((layer, index) =>
      validateWorkflowLayer(layer, `${path}.layers[${index}]`)
    );
  }

  return validated;
}

function validateWorkflowLink(
  link: unknown,
  path: string
): PresentationWorkflowLink {
  if (!isObject(link)) {
    throw new ValidationError(`${path} must be an object`);
  }
  assertString(link.id, `${path}.id must be a string`);
  assertString(link.source, `${path}.source must be a string`);
  assertString(link.target, `${path}.target must be a string`);
  assertNumber(link.value, `${path}.value must be a number`);
  return {
    id: link.id,
    source: link.source,
    target: link.target,
    value: link.value,
  };
}

function validateSnapshot(
  snapshot: unknown,
  index: number
): PresentationSnapshot {
  if (!isObject(snapshot)) {
    throw new ValidationError(`days[${index}] must be an object`);
  }

  assertNumber(snapshot.dayIndex, `days[${index}].dayIndex must be a number`);
  assertString(snapshot.date, `days[${index}].date must be a string`);

  const summary = snapshot.summary;
  if (!isObject(summary)) {
    throw new ValidationError(`days[${index}].summary must be an object`);
  }
  assertNumber(
    summary.dailyRevenue,
    `days[${index}].summary.dailyRevenue must be a number`
  );
  assertNumber(
    summary.dailyCharity,
    `days[${index}].summary.dailyCharity must be a number`
  );
  assertNumber(
    summary.dailyFees,
    `days[${index}].summary.dailyFees must be a number`
  );
  assertNumber(
    summary.dailyPayouts,
    `days[${index}].summary.dailyPayouts must be a number`
  );
  assertNumber(
    summary.netChange,
    `days[${index}].summary.netChange must be a number`
  );

  const timeline = snapshot.timelineTick;
  if (!isObject(timeline)) {
    throw new ValidationError(`days[${index}].timelineTick must be an object`);
  }
  assertString(
    timeline.label,
    `days[${index}].timelineTick.label must be a string`
  );
  assertNumber(
    timeline.cumulativeRevenue,
    `days[${index}].timelineTick.cumulativeRevenue must be a number`
  );
  assertNumber(
    timeline.cumulativePlayers,
    `days[${index}].timelineTick.cumulativePlayers must be a number`
  );
  assertNumber(
    timeline.cumulativeFees,
    `days[${index}].timelineTick.cumulativeFees must be a number`
  );
  assertNumber(
    timeline.cumulativeCharity,
    `days[${index}].timelineTick.cumulativeCharity must be a number`
  );
  assertNumber(
    timeline.cumulativePayouts,
    `days[${index}].timelineTick.cumulativePayouts must be a number`
  );

  const financialWorkflow = snapshot.financialWorkflow;
  if (!isObject(financialWorkflow)) {
    throw new ValidationError(
      `days[${index}].financialWorkflow must be an object`
    );
  }
  assertArray(
    financialWorkflow.nodes,
    `days[${index}].financialWorkflow.nodes must be an array`
  );
  assertArray(
    financialWorkflow.links,
    `days[${index}].financialWorkflow.links must be an array`
  );

  const validatedNodes = financialWorkflow.nodes.map(
    (node: unknown, nodeIdx: number) =>
      validateWorkflowNode(
        node,
        `days[${index}].financialWorkflow.nodes[${nodeIdx}]`
      )
  );
  const validatedLinks = financialWorkflow.links.map(
    (link: unknown, linkIdx: number) =>
      validateWorkflowLink(
        link,
        `days[${index}].financialWorkflow.links[${linkIdx}]`
      )
  );

  const charts = snapshot.charts;
  if (!isObject(charts)) {
    throw new ValidationError(`days[${index}].charts must be an object`);
  }
  assertArray(
    charts.distributionSeries,
    `days[${index}].charts.distributionSeries must be an array`
  );
  assertArray(
    charts.accumulationSeries,
    `days[${index}].charts.accumulationSeries must be an array`
  );

  const distributionSeries = charts.distributionSeries.map(
    (point: unknown, pointIdx: number) =>
      validateDistributionPoint(
        point,
        `days[${index}].charts.distributionSeries[${pointIdx}]`
      )
  );
  const accumulationSeries = charts.accumulationSeries.map(
    (point: unknown, pointIdx: number) =>
      validateAccumulationPoint(
        point,
        `days[${index}].charts.accumulationSeries[${pointIdx}]`
      )
  );

  // Optional pool block
  let pool: PresentationSnapshot["pool"] | undefined;
  if ((snapshot as any).pool !== undefined) {
    const p = (snapshot as any).pool;
    if (!isObject(p)) {
      throw new ValidationError(
        `days[${index}].pool must be an object if provided`
      );
    }
    assertNumber(
      p.depositedToday,
      `days[${index}].pool.depositedToday must be a number`
    );
    assertNumber(
      p.consumedToday,
      `days[${index}].pool.consumedToday must be a number`
    );
    assertNumber(
      p.outstanding,
      `days[${index}].pool.outstanding must be a number`
    );
    pool = {
      depositedToday: p.depositedToday,
      consumedToday: p.consumedToday,
      outstanding: p.outstanding,
    };
  }

  // Optional cashouts block
  let cashouts: PresentationSnapshot["cashouts"] | undefined;
  if ((snapshot as any).cashouts !== undefined) {
    const c = (snapshot as any).cashouts;
    if (!isObject(c)) {
      throw new ValidationError(
        `days[${index}].cashouts must be an object if provided`
      );
    }
    assertNumber(
      c.countToday,
      `days[${index}].cashouts.countToday must be a number`
    );
    assertNumber(
      c.amountToday,
      `days[${index}].cashouts.amountToday must be a number`
    );
    if (c.cumulativeAmount !== undefined) {
      assertNumber(
        c.cumulativeAmount,
        `days[${index}].cashouts.cumulativeAmount must be a number if provided`
      );
    }
    if (c.cumulativeCount !== undefined) {
      assertNumber(
        c.cumulativeCount,
        `days[${index}].cashouts.cumulativeCount must be a number if provided`
      );
    }
    cashouts = {
      countToday: c.countToday,
      amountToday: c.amountToday,
      cumulativeAmount: c.cumulativeAmount,
      cumulativeCount: c.cumulativeCount,
    };
  }

  return {
    dayIndex: snapshot.dayIndex,
    date: snapshot.date,
    summary: {
      dailyRevenue: summary.dailyRevenue,
      dailyCharity: summary.dailyCharity,
      dailyFees: summary.dailyFees,
      dailyPayouts: summary.dailyPayouts,
      netChange: summary.netChange,
    },
    timelineTick: {
      label: timeline.label,
      cumulativeRevenue: timeline.cumulativeRevenue,
      cumulativePlayers: timeline.cumulativePlayers,
      cumulativeFees: timeline.cumulativeFees,
      cumulativeCharity: timeline.cumulativeCharity,
      cumulativePayouts: timeline.cumulativePayouts,
    },
    financialWorkflow: {
      nodes: validatedNodes,
      links: validatedLinks,
    },
    charts: {
      distributionSeries,
      accumulationSeries,
    },
    ...(pool ? { pool } : {}),
    ...(cashouts ? { cashouts } : {}),
  };
}

export function validatePresentationSnapshotFile(
  input: unknown,
  options: ValidationOptions = {}
): PresentationSnapshotFile {
  if (!isObject(input)) {
    throw new ValidationError("Snapshot root must be an object");
  }

  assertString(input.scenarioId, "scenarioId must be a string");
  assertString(input.generatedAt, "generatedAt must be a string");

  const parameters = input.parameters;
  if (!isObject(parameters)) {
    throw new ValidationError("parameters must be an object");
  }
  assertString(
    parameters.adoptionRate,
    "parameters.adoptionRate must be a string"
  );
  assertString(
    parameters.cashOutStrategy,
    "parameters.cashOutStrategy must be a string"
  );
  assertString(
    parameters.charityShare,
    "parameters.charityShare must be a string"
  );

  const coordinates = input.coordinates;
  if (!isObject(coordinates)) {
    throw new ValidationError("coordinates must be an object");
  }
  assertNumber(
    coordinates.adoptionRate,
    "coordinates.adoptionRate must be a number"
  );
  assertNumber(
    coordinates.cashOutStrategy,
    "coordinates.cashOutStrategy must be a number"
  );
  assertNumber(
    coordinates.charityShare,
    "coordinates.charityShare must be a number"
  );

  const totals = input.totals;
  if (!isObject(totals)) {
    throw new ValidationError("totals must be an object");
  }
  assertNumber(totals.players, "totals.players must be a number");
  assertNumber(totals.activePlayers, "totals.activePlayers must be a number");
  assertNumber(
    totals.cumulativeRevenue,
    "totals.cumulativeRevenue must be a number"
  );
  assertNumber(
    totals.cumulativeCharity,
    "totals.cumulativeCharity must be a number"
  );
  assertNumber(totals.cumulativeFees, "totals.cumulativeFees must be a number");
  assertNumber(
    totals.cumulativePayouts,
    "totals.cumulativePayouts must be a number"
  );

  assertArray(input.days, "days must be an array");

  if (!options.allowEmptyDays && input.days.length === 0) {
    throw new ValidationError("days must contain at least one snapshot");
  }

  const days = input.days.map((snapshot: unknown, index: number) =>
    validateSnapshot(snapshot, index)
  );

  return {
    scenarioId: input.scenarioId,
    generatedAt: input.generatedAt,
    parameters: {
      adoptionRate: parameters.adoptionRate,
      cashOutStrategy: parameters.cashOutStrategy,
      charityShare: parameters.charityShare,
    },
    coordinates: {
      adoptionRate: coordinates.adoptionRate,
      cashOutStrategy: coordinates.cashOutStrategy,
      charityShare: coordinates.charityShare,
    },
    totals: {
      players: totals.players,
      activePlayers: totals.activePlayers,
      cumulativeRevenue: totals.cumulativeRevenue,
      cumulativeCharity: totals.cumulativeCharity,
      cumulativeFees: totals.cumulativeFees,
      cumulativePayouts: totals.cumulativePayouts,
    },
    days,
  };
}

function validateManifestEntry(
  entry: unknown,
  index: number
): PresentationManifestEntry {
  if (!isObject(entry)) {
    throw new ValidationError(`manifest[${index}] must be an object`);
  }

  assertString(
    entry.scenarioId,
    `manifest[${index}].scenarioId must be a string`
  );
  assertString(entry.path, `manifest[${index}].path must be a string`);
  assertString(
    entry.generatedAt,
    `manifest[${index}].generatedAt must be a string`
  );
  assertNumber(entry.days, `manifest[${index}].days must be a number`);

  const parameters = entry.parameters;
  if (!isObject(parameters)) {
    throw new ValidationError(
      `manifest[${index}].parameters must be an object`
    );
  }
  assertString(
    parameters.adoptionRate,
    `manifest[${index}].parameters.adoptionRate must be a string`
  );
  assertString(
    parameters.cashOutStrategy,
    `manifest[${index}].parameters.cashOutStrategy must be a string`
  );
  assertString(
    parameters.charityShare,
    `manifest[${index}].parameters.charityShare must be a string`
  );

  const coordinates = entry.coordinates;
  if (!isObject(coordinates)) {
    throw new ValidationError(
      `manifest[${index}].coordinates must be an object`
    );
  }
  assertNumber(
    coordinates.adoptionRate,
    `manifest[${index}].coordinates.adoptionRate must be a number`
  );
  assertNumber(
    coordinates.cashOutStrategy,
    `manifest[${index}].coordinates.cashOutStrategy must be a number`
  );
  assertNumber(
    coordinates.charityShare,
    `manifest[${index}].coordinates.charityShare must be a number`
  );

  return {
    scenarioId: entry.scenarioId,
    path: entry.path,
    generatedAt: entry.generatedAt,
    days: entry.days,
    parameters: {
      adoptionRate: parameters.adoptionRate,
      cashOutStrategy: parameters.cashOutStrategy,
      charityShare: parameters.charityShare,
    },
    coordinates: {
      adoptionRate: coordinates.adoptionRate,
      cashOutStrategy: coordinates.cashOutStrategy,
      charityShare: coordinates.charityShare,
    },
  };
}

export function validatePresentationManifest(
  input: unknown
): PresentationManifest {
  assertArray(input, "manifest must be an array");
  return input.map((entry: unknown, index: number) =>
    validateManifestEntry(entry, index)
  );
}

export function toValidationError(error: unknown): Error {
  if (error instanceof ValidationError) {
    return error;
  }
  if (error instanceof Error) {
    return new Error(error.message);
  }
  return new Error("Unknown validation error");
}

export function createValidationErrorWithContext(
  message: string,
  context: Record<string, unknown> = {}
): Error {
  const contextStr =
    Object.keys(context).length > 0
      ? `\nContext: ${JSON.stringify(context, null, 2)}`
      : "";
  return new ValidationError(`${message}${contextStr}`);
}

export function flattenValidationErrors(errors: string[]): string {
  if (errors.length === 0) return "No validation errors";
  if (errors.length === 1) return errors[0];
  return `Multiple validation errors:\n${errors
    .map((err, i) => `  ${i + 1}. ${err}`)
    .join("\n")}`;
}

export function assertCoordinatesInRange(
  coordinates: PresentationScenarioCoordinates,
  messagePrefix = "coordinates"
): void {
  const entries = Object.entries(coordinates) as [string, number][];
  for (const [name, value] of entries) {
    if (value < 0 || value > 1) {
      throw new ValidationError(
        `${messagePrefix}.${name} must be within the [0, 1] range (received ${value})`
      );
    }
  }
}

export { ValidationError };
