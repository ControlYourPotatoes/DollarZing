import {
  useImpactCalculations,
  useCountUp,
} from "../hooks/useImpactCalculations";
import type { ImpactDisplayProps } from "../types";
import { formatCurrency } from "../types";

const DEFAULT_PROPS: Required<
  Pick<ImpactDisplayProps, "foodConfig" | "waterConfig" | "animationDuration">
> = {
  foodConfig: { mealsPerDollar: 10, lbsPerDollar: 1 },
  waterConfig: { personDaysPerDollar: 20, litersPerDollar: 1000 },
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
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M8 12h8M12 8v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );

  const WaterIcon = () => (
    <svg
      className="h-6 w-6 text-sky-400"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 2L8 6h8l-4-4z" />
      <path d="M12 6c-3.31 0-6 2.69-6 6 0 1.66.69 3.17 1.81 4.27l4.19 4.19 4.19-4.19C17.31 15.17 18 13.66 18 12c0-3.31-2.69-6-6-6z" />
      <path
        d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
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
          <span className="text-xs uppercase tracking-widest text-slate-500">
            Team Food Impact
          </span>
        </div>
        <p className="text-3xl font-semibold text-amber-400">
          {animatedMeals.toLocaleString()} Meals
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Provided to families in need (via Feeding America)
        </p>
        <p className="mt-1 text-xs text-slate-500">
          or ~{metrics.lbs.toLocaleString()} lbs rescued
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center gap-3">
          <WaterIcon />
          <span className="text-xs uppercase tracking-widest text-slate-500">
            Team Water Impact
          </span>
        </div>
        <p className="text-3xl font-semibold text-sky-400">
          {animatedPersonDays.toLocaleString()} Person-Days
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Of clean water access (via WaterAid)
        </p>
        <p className="mt-1 text-xs text-slate-500">
          or ~{metrics.liters.toLocaleString()} liters provided
        </p>
      </div>
    </div>
  );
};

export default ImpactDisplay;
