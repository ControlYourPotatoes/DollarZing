import { useEffect, useMemo, useRef, useState } from "react";

import type { ImpactDisplayProps, ImpactMetrics } from "../types";

interface UseImpactCalculationsOptions {
  foodConfig: Required<ImpactDisplayProps>["foodConfig"];
  waterConfig: Required<ImpactDisplayProps>["waterConfig"];
}

export function useImpactCalculations(
  cumulativeCharity: number | null | undefined,
  { foodConfig, waterConfig }: UseImpactCalculationsOptions
) {
  const metrics = useMemo<ImpactMetrics | null>(() => {
    if (!cumulativeCharity || cumulativeCharity <= 0) {
      return null;
    }

    const meals = Math.round(cumulativeCharity * foodConfig.mealsPerDollar);
    const lbs = Math.round(cumulativeCharity * foodConfig.lbsPerDollar);
    const personDays = Math.round(
      cumulativeCharity * waterConfig.personDaysPerDollar
    );
    const liters = Math.round(
      cumulativeCharity * waterConfig.litersPerDollar
    );

    return {
      meals,
      lbs,
      personDays,
      liters,
    };
  }, [cumulativeCharity, foodConfig.lbsPerDollar, foodConfig.mealsPerDollar, waterConfig.litersPerDollar, waterConfig.personDaysPerDollar]);

  return { metrics };
}

export function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const initialRef = useRef(0);
  const previousTargetRef = useRef(target);

  useEffect(() => {
    if (target === previousTargetRef.current) {
      return;
    }
    previousTargetRef.current = target;
    initialRef.current = value;
    startRef.current = null;

    let frameId: number;

    const step = (timestamp: number) => {
      if (startRef.current === null) {
        startRef.current = timestamp;
      }
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(1, duration > 0 ? elapsed / duration : 1);
      const nextValue = Math.round(
        initialRef.current + (target - initialRef.current) * progress
      );
      setValue(nextValue);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameId);
  }, [duration, target, value]);

  return value;
}

