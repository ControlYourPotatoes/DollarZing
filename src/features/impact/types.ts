export interface ImpactMetrics {
  meals: number;
  lbs: number;
  personDays: number;
  liters: number;
}

export interface ImpactDisplayProps {
  cumulativeCharity?: number | null;
  foodConfig?: {
    mealsPerDollar: number;
    lbsPerDollar: number;
  };
  waterConfig?: {
    personDaysPerDollar: number;
    litersPerDollar: number;
  };
  animationDuration?: number;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

