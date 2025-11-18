import {
  useImpactCalculations,
  useCountUp,
} from "../hooks/useImpactCalculations";
import type { ImpactDisplayProps } from "../types";
import { formatCurrency } from "../types";

const DEFAULT_PROPS: Required<
  Pick<ImpactDisplayProps, "foodConfig" | "waterConfig" | "animationDuration">
> = {
  foodConfig: { mealsPerDollar: 9, lbsPerDollar: 10 },
  waterConfig: { personYearsPerDollar: 1 / 40, litersPerDollar: 500 },
  animationDuration: 1500,
};

export const ImpactDisplay = (props: ImpactDisplayProps) => {
  const { cumulativeCharity, foodConfig, waterConfig, animationDuration } = {
    ...DEFAULT_PROPS,
    ...props,
  };

  const { metrics } = useImpactCalculations(cumulativeCharity || null, {
    foodConfig,
    waterConfig,
  });

  const animatedMeals = useCountUp(metrics?.meals ?? 0, animationDuration);
  const animatedPersonYears = useCountUp(
    metrics?.personYears ?? 0,
    animationDuration
  );
  const animatedPersonDays = useCountUp(
    metrics?.personDays ?? 0,
    animationDuration
  );

  if (!metrics) {
    return <div className="text-slate-500">No impact data available.</div>;
  }

  const FoodIcon = () => (
    <svg
      className="h-6 w-6 text-amber-400"
      viewBox="0 -3.84 122.88 122.88"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M29.03,100.46l20.79-25.21l9.51,12.13L41,110.69C33.98,119.61,20.99,110.21,29.03,100.46L29.03,100.46z M53.31,43.05 c1.98-6.46,1.07-11.98-6.37-20.18L28.76,1c-2.58-3.03-8.66,1.42-6.12,5.09L37.18,24c2.75,3.34-2.36,7.76-5.2,4.32L16.94,9.8 c-2.8-3.21-8.59,1.03-5.66,4.7c4.24,5.1,10.8,13.43,15.04,18.53c2.94,2.99-1.53,7.42-4.43,3.69L6.96,18.32 c-2.19-2.38-5.77-0.9-6.72,1.88c-1.02,2.97,1.49,5.14,3.2,7.34L20.1,49.06c5.17,5.99,10.95,9.54,17.67,7.53 c1.03-0.31,2.29-0.94,3.64-1.77l44.76,57.78c2.41,3.11,7.06,3.44,10.08,0.93l0.69-0.57c3.4-2.83,3.95-8,1.04-11.34L50.58,47.16 C51.96,45.62,52.97,44.16,53.31,43.05L53.31,43.05z M65.98,55.65l7.37-8.94C63.87,23.21,99-8.11,116.03,6.29 C136.72,23.8,105.97,66,84.36,55.57l-8.73,11.09L65.98,55.65L65.98,55.65z" />
    </svg>
  );

  const WaterIcon = () => (
    <svg
      className="h-6 w-6 text-sky-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5s-6 6.3-6 10.5a6 6 0 0 0 12 0c0-4.2-6-10.5-6-10.5Z" />
      <path d="M12 11v.01" />
      <path d="M8 14a4 4 0 0 0 8 0" />
    </svg>
  );

  return (
    <div
      className="grid grid-cols-1 gap-4 text-sm text-slate-300 sm:grid-cols-2"
      aria-label={`Cumulative impact from ${formatCurrency(
        cumulativeCharity ?? 0
      )}`}
    >
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center gap-3">
          <FoodIcon />
          <div>
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Team Food Impact
            </span>
            <div className="text-[11px] text-slate-500">
              ≈9 meals/$ · ~1.1 lbs/meal
            </div>
          </div>
        </div>
        <p className="text-3xl font-semibold text-amber-400">
          {animatedMeals.toLocaleString()} Meals
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Estimated at ~9 meals per $ (Feeding America style average)
        </p>
        <p className="mt-1 text-xs text-slate-500">
          or ~{metrics.lbs.toLocaleString()} lbs rescued
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center gap-3">
          <WaterIcon />
          <div>
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Team Water Impact
            </span>
            <div className="text-[11px] text-slate-500">
              ≈$40/person-year · ~35L/day (liters from person-days)
            </div>
          </div>
        </div>
        <p className="text-3xl font-semibold text-sky-400">
          {animatedPersonYears.toLocaleString()} Person-Years
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Estimated at ~$40 per person-year, ~35L/day
        </p>
        <p className="mt-1 text-xs text-slate-500">
          ≈{animatedPersonDays.toLocaleString()} person-days of access
        </p>
        <p className="mt-1 text-xs text-slate-500">
          or ~{metrics.liters.toLocaleString()} liters provided
        </p>
      </div>
    </div>
  );
};

export default ImpactDisplay;
