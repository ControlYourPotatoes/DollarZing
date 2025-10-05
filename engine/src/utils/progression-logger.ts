import winston from "winston";

/**
 * Progression Logger - Structured logging for CLI visual feedback
 * Provides always-on logs for simulation progress tracking
 */

// Define progression log levels
export const PROGRESSION_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  progression: 3,
  debug: 4,
} as const;

export type ProgressionLevel = keyof typeof PROGRESSION_LEVELS;

// Optional callback for collecting progression data
let progressionDataCallback: ((event: string, data: any) => void) | null = null;

export function setProgressionDataCallback(
  callback: (event: string, data: any) => void
) {
  progressionDataCallback = callback;
}

// Add colors to winston
winston.addColors({
  error: "red",
  warn: "yellow",
  info: "blue",
  progression: "green",
  debug: "gray",
});

// Create Winston logger for progression
const progressionLogger = winston.createLogger({
  levels: PROGRESSION_LEVELS,
  level: "progression", // Show progression and above (error, warn, info, progression)
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "dollarzing-progression" },
  transports: [
    // Console transport with human-readable formatting for CLI
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr =
            Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

// Helper functions for common progression events
export const progression = {
  dayStarted: (day: number, totalDays: number) => {
    const data = {
      event: "day_started",
      currentDay: day,
      totalDays,
    };
    progressionLogger.log(
      "progression",
      `Day ${day}/${totalDays} started`,
      data
    );
    progressionDataCallback?.("day_started", data);
  },

  dayEnded: (day: number, totalDays: number, stats: any) => {
    const data = {
      event: "day_ended",
      currentDay: day,
      totalDays,
      ...stats,
    };
    progressionLogger.log(
      "progression",
      `Day ${day}/${totalDays} completed`,
      data
    );
    progressionDataCallback?.("day_ended", data);
  },

  playerGrowth: (
    day: number,
    activePlayers: number,
    newPlayers: number,
    eliminatedPlayers: number
  ) => {
    const data = {
      event: "player_growth",
      day,
      activePlayers,
      newPlayers,
      eliminatedPlayers,
    };
    progressionLogger.log(
      "progression",
      `Player growth: ${activePlayers} active (+${newPlayers}, -${eliminatedPlayers})`,
      data
    );
    progressionDataCallback?.("player_growth", data);
  },

  gamesCompleted: (day: number, gamesToday: number, totalGames: number) => {
    const data = {
      event: "games_completed",
      day,
      gamesToday,
      totalGames,
    };
    progressionLogger.log(
      "progression",
      `Games completed: ${gamesToday} today, ${totalGames} total`,
      data
    );
    progressionDataCallback?.("games_completed", data);
  },

  revenueUpdate: (day: number, dailyRevenue: number, totalRevenue: number) => {
    const data = {
      event: "revenue_update",
      day,
      dailyRevenue,
      totalRevenue,
    };
    progressionLogger.log(
      "progression",
      `Revenue: $${dailyRevenue.toFixed(2)} today, $${totalRevenue.toFixed(
        2
      )} total`,
      data
    );
    progressionDataCallback?.("revenue_update", data);
  },

  poolStatus: (level: number, poolSize: number, waitingPlayers: number) => {
    const data = {
      event: "pool_status",
      level,
      poolSize,
      waitingPlayers,
    };
    progressionLogger.log(
      "progression",
      `Level ${level} pool: ${poolSize} dollars, ${waitingPlayers} waiting`,
      data
    );
    progressionDataCallback?.("pool_status", data);
  },

  matchmakingCompleted: (
    matchesMade: number,
    gamesCreated: number,
    poolSize: number
  ) => {
    const data = {
      event: "matchmaking_completed",
      matchesMade,
      gamesCreated,
      poolSize,
    };
    // Async logging to prevent blocking
    process.nextTick(() => {
      progressionLogger.log(
        "progression",
        `Matchmaking: ${matchesMade} matches, ${gamesCreated} games created, ${poolSize} remaining in pool`,
        data
      );
      progressionDataCallback?.("matchmaking_completed", data);
    });
  },

  simulationComplete: (totalDays: number, finalStats: any) => {
    const data = {
      event: "simulation_complete",
      totalDays,
      ...finalStats,
    };
    progressionLogger.info(
      `Simulation completed: ${totalDays} days processed`,
      data
    );
    progressionDataCallback?.("simulation_complete", data);
  },

  // Structured error logging - always visible
  simulationError: (error: Error, context?: any) => {
    const data = {
      event: "simulation_error",
      error: error.message,
      stack: error.stack,
      ...context,
    };
    progressionLogger.error(`Simulation error: ${error.message}`, data);
    progressionDataCallback?.("simulation_error", data);
  },

  // Structured warning logging - could be always visible or verbose-only
  simulationWarning: (message: string, context?: any) => {
    const data = {
      event: "simulation_warning",
      ...context,
    };
    progressionLogger.warn(`Simulation warning: ${message}`, data);
    progressionDataCallback?.("simulation_warning", data);
  },
};

// Export logger instance for custom logging
export { progressionLogger };
