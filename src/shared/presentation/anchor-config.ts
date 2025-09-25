export interface AnchorParameters {
  growth: number; // 15, 35, 60
  risk: "low" | "mid" | "high";
  charity: number; // 10, 20, 30
}

export interface CoordinateMapping {
  adoptionRate: number;
  cashOutStrategy: number;
  charityShare: number;
}

export const ANCHOR_LEVELS = {
  growth: [15, 35, 60] as const,
  risk: ["low", "mid", "high"] as const,
  charity: [10, 20, 30] as const,
} as const;

export const PARAM_TO_COORD_MAP: Record<number | string, CoordinateMapping> = {
  // Growth to adoptionRate
  15: { adoptionRate: 0.01 },
  35: { adoptionRate: 0.1 },
  60: { adoptionRate: 0.5 },
  // Risk to cashOutStrategy
  low: { cashOutStrategy: 0.0 },
  mid: { cashOutStrategy: 0.5 },
  high: { cashOutStrategy: 1.0 },
  // Charity to charityShare
  10: { charityShare: 0.1 },
  20: { charityShare: 0.2 },
  30: { charityShare: 0.3 },
};

export const COORD_TO_PARAM_MAP: Record<number, number | string> = {
  // adoptionRate to growth
  0.01: 15,
  0.1: 35,
  0.5: 60,
  // cashOutStrategy to risk
  0.0: "low",
  0.5: "mid",
  1.0: "high",
  // charityShare to charity
  0.1: 10,
  0.2: 20,
  0.3: 30,
};

export function getAnchorKey(params: AnchorParameters): string {
  return `growth-${params.growth}_risk-${params.risk}_charity-${params.charity}`;
}

export function parseAnchorKey(key: string): AnchorParameters | null {
  const match = key.match(/^growth-(\d+)_risk-(\w+)_charity-(\d+)$/);
  if (!match) return null;
  const [, growth, risk, charity] = match;
  return {
    growth: parseInt(growth),
    risk: risk as "low" | "mid" | "high",
    charity: parseInt(charity),
  };
}

export function coordinatesToAnchorParams(
  coords: CoordinateMapping
): AnchorParameters {
  return {
    growth: COORD_TO_PARAM_MAP[coords.adoptionRate] as number,
    risk: COORD_TO_PARAM_MAP[coords.cashOutStrategy] as "low" | "mid" | "high",
    charity: COORD_TO_PARAM_MAP[coords.charityShare] as number,
  };
}

export function anchorParamsToCoordinates(
  params: AnchorParameters
): CoordinateMapping {
  const coordGrowth = PARAM_TO_COORD_MAP[params.growth].adoptionRate;
  const coordRisk = PARAM_TO_COORD_MAP[params.risk].cashOutStrategy;
  const coordCharity = PARAM_TO_COORD_MAP[params.charity].charityShare;
  return {
    adoptionRate: coordGrowth,
    cashOutStrategy: coordRisk,
    charityShare: coordCharity,
  };
}

export function getRelativeAnchor(
  baseParams: AnchorParameters,
  relative: "mid" | "high"
): AnchorParameters {
  const growthIndex = ANCHOR_LEVELS.growth.findIndex(
    (g) => g === baseParams.growth
  );
  const riskIndex = ANCHOR_LEVELS.risk.findIndex((r) => r === baseParams.risk);

  const relativeGrowthIndex =
    relative === "mid"
      ? Math.floor(ANCHOR_LEVELS.growth.length / 2) // Mid: index 1 (35)
      : ANCHOR_LEVELS.growth.length - 1; // High: last index (60)

  const relativeRiskIndex =
    relative === "mid"
      ? Math.floor(ANCHOR_LEVELS.risk.length / 2) // Mid: index 1 ('mid')
      : ANCHOR_LEVELS.risk.length - 1; // High: last index ('high')

  return {
    growth: ANCHOR_LEVELS.growth[relativeGrowthIndex],
    risk: ANCHOR_LEVELS.risk[relativeRiskIndex],
    charity: baseParams.charity, // Keep base charity
  };
}
