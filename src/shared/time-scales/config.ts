export type TimeScale = "daily" | "weekly" | "monthly";

export interface TimeScaleThresholds {
  dailyUntil: number; // inclusive end index for daily granularity
  weeklyUntil: number; // inclusive end index for weekly granularity
}

export const DEFAULT_THRESHOLDS: TimeScaleThresholds = {
  dailyUntil: 30, // days 0..30 => daily
  weeklyUntil: 120, // days 31..120 => weekly
};

export function getTimeScaleForIndex(
  duration: number,
  index: number,
  thresholds: TimeScaleThresholds = DEFAULT_THRESHOLDS
): TimeScale {
  void duration; // reserved for future use (e.g., adaptive thresholds)
  if (index <= thresholds.dailyUntil) return "daily";
  if (index <= thresholds.weeklyUntil) return "weekly";
  return "monthly";
}

export function getStepForScale(scale: TimeScale): number {
  switch (scale) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 30; // coarse jump for long ranges
    default:
      return 1;
  }
}
