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
    progressionLogger.log("progression", `Day ${day}/${totalDays} started`, {
      event: "day_started",
      currentDay: day,
      totalDays,
    });
  },

  dayEnded: (day: number, totalDays: number, stats: any) => {
    progressionLogger.log("progression", `Day ${day}/${totalDays} completed`, {
      event: "day_ended",
      currentDay: day,
      totalDays,
      ...stats,
    });
  },

  playerGrowth: (
    day: number,
    activePlayers: number,
    newPlayers: number,
    eliminatedPlayers: number
  ) => {
    progressionLogger.log(
      "progression",
      `Player growth: ${activePlayers} active (+${newPlayers}, -${eliminatedPlayers})`,
      {
        event: "player_growth",
        day,
        activePlayers,
        newPlayers,
        eliminatedPlayers,
      }
    );
  },

  gamesCompleted: (day: number, gamesToday: number, totalGames: number) => {
    progressionLogger.log(
      "progression",
      `Games completed: ${gamesToday} today, ${totalGames} total`,
      {
        event: "games_completed",
        day,
        gamesToday,
        totalGames,
      }
    );
  },

  revenueUpdate: (day: number, dailyRevenue: number, totalRevenue: number) => {
    progressionLogger.log(
      "progression",
      `Revenue: $${dailyRevenue.toFixed(2)} today, $${totalRevenue.toFixed(
        2
      )} total`,
      {
        event: "revenue_update",
        day,
        dailyRevenue,
        totalRevenue,
      }
    );
  },

  poolStatus: (level: number, poolSize: number, waitingPlayers: number) => {
    progressionLogger.log(
      "progression",
      `Level ${level} pool: ${poolSize} dollars, ${waitingPlayers} waiting`,
      {
        event: "pool_status",
        level,
        poolSize,
        waitingPlayers,
      }
    );
  },

  simulationComplete: (totalDays: number, finalStats: any) => {
    progressionLogger.info(
      `Simulation completed: ${totalDays} days processed`,
      {
        event: "simulation_complete",
        totalDays,
        ...finalStats,
      }
    );
  },

  // Structured error logging - always visible
  simulationError: (error: Error, context?: any) => {
    progressionLogger.error(`Simulation error: ${error.message}`, {
      event: "simulation_error",
      error: error.message,
      stack: error.stack,
      ...context,
    });
  },

  // Structured warning logging - could be always visible or verbose-only
  simulationWarning: (message: string, context?: any) => {
    progressionLogger.warn(`Simulation warning: ${message}`, {
      event: "simulation_warning",
      ...context,
    });
  },
};

// Export logger instance for custom logging
export { progressionLogger };
