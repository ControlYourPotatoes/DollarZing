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

// Forward maps from discrete params → normalized coordinates
const GROWTH_TO_ADOPTION: Record<number, number> = { 15: 0, 35: 0.5, 60: 1 };
const RISK_TO_CASHOUT: Record<"low" | "mid" | "high", number> = {
  low: 0,
  mid: 0.5,
  high: 1,
};
const CHARITY_TO_SHARE: Record<number, number> = { 10: 0, 20: 0.5, 30: 1 };

// Reverse maps from normalized coordinates → discrete params
const ADOPTION_TO_GROWTH: Record<number, number> = { 0: 15, 0.5: 35, 1: 60 };
const CASHOUT_TO_RISK: Record<number, "low" | "mid" | "high"> = {
  0: "low",
  0.5: "mid",
  1: "high",
};
const SHARE_TO_CHARITY: Record<number, number> = { 0: 10, 0.5: 20, 1: 30 };

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
    growth: ADOPTION_TO_GROWTH[coords.adoptionRate],
    risk: CASHOUT_TO_RISK[coords.cashOutStrategy],
    charity: SHARE_TO_CHARITY[coords.charityShare],
  };
}

export function anchorParamsToCoordinates(
  params: AnchorParameters
): CoordinateMapping {
  const coordGrowth = GROWTH_TO_ADOPTION[params.growth];
  const coordRisk = RISK_TO_CASHOUT[params.risk];
  const coordCharity = CHARITY_TO_SHARE[params.charity];
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

/**
 * Compute an absolute anchor for a given level while preserving the base charity.
 * Useful for UI controls that directly switch baseline among low/mid/high.
 */
export function getAbsoluteAnchor(
  baseParams: AnchorParameters,
  level: "low" | "mid" | "high"
): AnchorParameters {
  const idx = level === "low" ? 0 : level === "mid" ? 1 : 2;
  return {
    growth: ANCHOR_LEVELS.growth[idx],
    risk: ANCHOR_LEVELS.risk[idx],
    charity: baseParams.charity,
  };
}
