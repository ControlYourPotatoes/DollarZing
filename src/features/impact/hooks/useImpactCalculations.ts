import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ImpactMetrics,
  ImpactDisplayProps,
  ImpactProfiles,
} from "../types";

const FOOD_PROFILE = {
  mealsPerDollar: 10, // Feeding America style claim
  poundsPerMeal: 1.2, // USDA/Feeding America conversion
};

const WATER_PROFILE_TEAM = {
  personYearsPerDollar: 1, // Team Water: $1 = 1 person-year
  litersPerPersonDay: 20, // UNHCR benchmark; UI hover can compare
  litersPerDollar: 1100, // Preserve existing per-dollar default for UI
};

const WATER_PROFILE_CONSERVATIVE = {
  personYearsPerDollar: 1 / 40, // ~$40/person-year
  litersPerPersonDay: 20,
};

export const useImpactCalculations = (
  cumulativeCharity: number | null,
  configs?: Pick<ImpactDisplayProps, "foodConfig" | "waterConfig">
): { metrics: ImpactMetrics | null; profiles: ImpactProfiles | null } => {
  const { metrics, profiles } = useMemo(() => {
    if (!cumulativeCharity) {
      return { metrics: null, profiles: null };
    }

    const resolvedMealsPerDollar =
      configs?.foodConfig?.mealsPerDollar ?? FOOD_PROFILE.mealsPerDollar;
    const resolvedPoundsPerMeal =
      configs?.foodConfig?.poundsPerMeal ??
      (configs?.foodConfig?.lbsPerDollar != null
        ? configs.foodConfig.lbsPerDollar / resolvedMealsPerDollar
        : FOOD_PROFILE.poundsPerMeal);

    const meals = Math.round(cumulativeCharity * resolvedMealsPerDollar);
    const lbs = Math.round(meals * resolvedPoundsPerMeal);

    const teamPersonYearsPerDollar =
      configs?.waterConfig?.personYearsPerDollar ??
      (configs?.waterConfig?.costPerPersonYear
        ? 1 / (configs.waterConfig.costPerPersonYear as number)
        : WATER_PROFILE_TEAM.personYearsPerDollar);

    const conservativePersonYearsPerDollar =
      configs?.waterConfig?.conservativePersonYearsPerDollar ??
      WATER_PROFILE_CONSERVATIVE.personYearsPerDollar;

    const litersPerPersonDay =
      configs?.waterConfig?.litersPerPersonDay ??
      WATER_PROFILE_TEAM.litersPerPersonDay;

    const litersPerDollarOverride =
      configs?.waterConfig?.litersPerDollar ?? WATER_PROFILE_TEAM.litersPerDollar;

    const computeWater = (personYearsPerDollar: number, useOverride = false) => {
      const personYears = Math.round(
        cumulativeCharity * personYearsPerDollar
      );
      const personDays = Math.round(
        cumulativeCharity * personYearsPerDollar * 365
      );
      const liters = useOverride
        ? Math.round(cumulativeCharity * litersPerDollarOverride)
        : Math.round(personDays * litersPerPersonDay);

      return { personYears, personDays, liters };
    };

    const teamWater = computeWater(teamPersonYearsPerDollar, true);
    const conservativeWater = computeWater(conservativePersonYearsPerDollar);

    const computedMetrics: ImpactMetrics = {
      meals,
      lbs,
      personYears: teamWater.personYears,
      personDays: teamWater.personDays,
      liters: teamWater.liters,
    };

    const computedProfiles: ImpactProfiles = {
      food: { meals, lbs },
      water: {
        team: teamWater,
        conservative: conservativeWater,
      },
    };

    return { metrics: computedMetrics, profiles: computedProfiles };
  }, [cumulativeCharity, configs?.foodConfig, configs?.waterConfig]);

  return { metrics, profiles };
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const useCountUp = (target: number, duration = 1500): number => {
  const [displayed, setDisplayed] = useState(0);
  const previousTargetRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const requestFrame =
      typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
    const cancelFrame =
      typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : null;

    // Cancel any ongoing animation
    if (animationFrameRef.current && cancelFrame) {
      cancelFrame(animationFrameRef.current);
    }

    if (target === 0) {
      setDisplayed(0);
      previousTargetRef.current = 0;
      startValueRef.current = 0;
      startTimeRef.current = null;
      return;
    }

    const previousTarget = previousTargetRef.current;

    // If target changed, start new animation from current displayed value
    if (previousTarget !== target) {
      startValueRef.current = displayed;
      previousTargetRef.current = target;
      startTimeRef.current = null; // Reset start time for new animation
    }

    const startValue = startValueRef.current;
    const valueDiff = target - startValue;

    // If no change needed, just set the target value
    if (valueDiff === 0) {
      setDisplayed(target);
      return;
    }

    const animate = (time: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = time;
      }

      const elapsed = time - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Animate from start value to target
      const animatedValue = startValue + valueDiff * easeOutCubic(progress);
      setDisplayed(Math.floor(animatedValue));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete, ensure final value is exact
        setDisplayed(target);
        startTimeRef.current = null;
        animationFrameRef.current = null;
      }
    };

    if (!requestFrame || !cancelFrame) {
      // Fallback: immediately set the target if RAF isn't available
      setDisplayed(target);
      return;
    }

    animationFrameRef.current = requestFrame(animate);

    return () => {
      if (animationFrameRef.current && cancelFrame) {
        cancelFrame(animationFrameRef.current);
      }
    };
  }, [target, duration]);

  return displayed;
};
