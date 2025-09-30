import { useEffect, useMemo, useRef, useState } from "react";
import type { ImpactMetrics, ImpactDisplayProps } from "../types";

const DEFAULT_FOOD_CONFIG = {
  mealsPerDollar: 10,
  lbsPerDollar: 1,
};

const DEFAULT_WATER_CONFIG = {
  personDaysPerDollar: 20,
  litersPerDollar: 1000,
};

export const useImpactCalculations = (
  cumulativeCharity: number | null,
  configs?: Pick<ImpactDisplayProps, "foodConfig" | "waterConfig">
): { metrics: ImpactMetrics | null } => {
  const metrics = useMemo(() => {
    if (!cumulativeCharity) {
      return null;
    }

    const foodConfig = { ...DEFAULT_FOOD_CONFIG, ...configs?.foodConfig };
    const waterConfig = { ...DEFAULT_WATER_CONFIG, ...configs?.waterConfig };

    return {
      meals: Math.round(cumulativeCharity * foodConfig.mealsPerDollar),
      lbs: Math.round(cumulativeCharity * foodConfig.lbsPerDollar),
      personDays: Math.round(
        cumulativeCharity * waterConfig.personDaysPerDollar
      ),
      liters: Math.round(cumulativeCharity * waterConfig.litersPerDollar),
    };
  }, [cumulativeCharity, configs?.foodConfig, configs?.waterConfig]);

  return { metrics };
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const useCountUp = (target: number, duration = 1500): number => {
  const [displayed, setDisplayed] = useState(0);
  const previousTargetRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any ongoing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
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

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [target, duration]);

  return displayed;
};
