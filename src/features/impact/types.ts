export interface ImpactMetrics {
  meals: number;
  lbs: number;
  personYears: number;
  liters: number;
  personDays?: number;
}

export interface ImpactDisplayProps {
  cumulativeCharity?: number | null;
  foodConfig?: {
    mealsPerDollar?: number;
    lbsPerDollar?: number;
    poundsPerMeal?: number;
  };
  waterConfig?: {
    personYearsPerDollar?: number;
    conservativePersonYearsPerDollar?: number;
    costPerPersonYear?: number;
    litersPerPersonDay?: number;
    litersPerDollar?: number;
  };
  animationDuration?: number;
}

export interface ImpactProfiles {
  food: {
    meals: number;
    lbs: number;
  };
  water: {
    team: {
      personYears: number;
      personDays: number;
      liters: number;
    };
    conservative: {
      personYears: number;
      personDays: number;
      liters: number;
    };
  };
}

export function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

