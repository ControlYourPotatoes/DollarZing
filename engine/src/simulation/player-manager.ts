import { PlayerBalanceManager } from "../types/player-balance-manager";
import { PlayerRunManager } from "../types/player-run-manager";
import { CashOutStrategy } from "../types/virtual-dollar-engine";

/**
 * Configuration for player management
 */
export interface PlayerManagementConfig {
  initialPlayerCount: number;
  initialDonationAmount: number;
  playerStrategies: Partial<Record<CashOutStrategy, number>>;
}

/**
 * Player statistics interface
 */
export interface PlayerStatistics {
  totalPlayers: number;
  activePlayers: number;
  retiredPlayers: number;
  totalDonationsFunds: number;
  totalWinningsFunds: number;
  totalProgressionFunds: number;
  averageGamesPerPlayer: number;
  playerRetirementRate: number;
}

/**
 * PlayerManager handles player lifecycle and initialization
 * Extracted from SimulationController to provide focused player management
 */
export class PlayerManager {
  constructor(
    private playerBalanceManager: PlayerBalanceManager,
    private runOrchestrator: PlayerRunManager
  ) {}

  /**
   * Initialize players with starting donation balance
   */
  initializePlayers(config: PlayerManagementConfig): number {
    const { initialPlayerCount, initialDonationAmount, playerStrategies } =
      config;

    // Calculate strategy counts
    const strategyCounts = new Map<CashOutStrategy, number>();
    Object.entries(playerStrategies).forEach(([strategy, percentage]) => {
      const count = Math.round(percentage * initialPlayerCount);
      strategyCounts.set(strategy as CashOutStrategy, count);
    });

    // Ensure we have exactly the right number of players
    let totalAssigned = Array.from(strategyCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    if (totalAssigned !== initialPlayerCount) {
      // Adjust the largest group to match exact count
      const largestStrategy = Array.from(strategyCounts.entries()).sort(
        ([, a], [, b]) => b - a
      )[0][0];
      const adjustment = initialPlayerCount - totalAssigned;
      strategyCounts.set(
        largestStrategy,
        strategyCounts.get(largestStrategy)! + adjustment
      );
    }

    // Create players with assigned strategies
    let playerIndex = 0;
    strategyCounts.forEach((count, strategy) => {
      for (let i = 0; i < count; i++) {
        const playerId = `player-${playerIndex}`;
        this.playerBalanceManager.createPlayer(
          playerId,
          initialDonationAmount,
          strategy
        );

        // Initialize player in run orchestrator
        this.runOrchestrator.initializePlayer(
          playerId,
          initialDonationAmount,
          strategy
        );

        playerIndex++;
      }
    });

    return playerIndex;
  }

  /**
   * Add new players based on growth model
   */
  addNewPlayersForDay(day: number, config: PlayerManagementConfig): void {
    // Growth model parameters (simplified version - could be configurable)
    const baseMarket = 1000; // 1000 potential users (scaled for testing)
    const adoptionRate = 0.1; // 10% adoption rate (aggressive growth for testing)
    const maxAdoption = baseMarket * adoptionRate; // Max 100 players

    // S-curve model: logistic function for market penetration
    const x = (day - 10) / 5; // Scale factor for curve steepness (midpoint at day 10)
    const adoptionProgress = 1 / (1 + Math.exp(-x));
    const targetPlayers = Math.floor(maxAdoption * adoptionProgress);

    // Calculate current player count
    const currentPlayerCount = this.runOrchestrator.getActivePlayerCount();

    // Add new players if we're below target
    const playersToAdd = Math.max(0, targetPlayers - currentPlayerCount);
    const dailyNewPlayers = Math.min(
      playersToAdd,
      Math.max(1, Math.ceil(playersToAdd * 0.2))
    ); // Up to 20% of gap per day

    if (dailyNewPlayers > 0) {
      console.log(`DEBUG: Day ${day}, Adding ${dailyNewPlayers} new players`);

      for (let i = 0; i < dailyNewPlayers; i++) {
        const playerId = `player-new-${day}-${i}`;

        // Assign random strategy based on distribution
        const strategies = Object.keys(
          config.playerStrategies
        ) as CashOutStrategy[];
        const strategyWeights = Object.values(config.playerStrategies);
        const randomValue = Math.random();
        let cumulativeWeight = 0;
        let selectedStrategy: CashOutStrategy = CashOutStrategy.BALANCED;

        for (let j = 0; j < strategies.length; j++) {
          cumulativeWeight += strategyWeights[j];
          if (randomValue <= cumulativeWeight) {
            selectedStrategy = strategies[j];
            break;
          }
        }

        // Initialize new player
        this.playerBalanceManager.createPlayer(
          playerId,
          config.initialDonationAmount,
          selectedStrategy
        );

        // Initialize player in run orchestrator
        this.runOrchestrator.initializePlayer(
          playerId,
          config.initialDonationAmount,
          selectedStrategy
        );
      }
    }
  }

  /**
   * Generate player statistics
   */
  getPlayerStatistics(config: PlayerManagementConfig): PlayerStatistics {
    const totalDonationFunds = this.playerBalanceManager.getTotalDonations();
    const totalWinningsFunds = this.playerBalanceManager.getTotalWinnings();

    const activePlayers = this.runOrchestrator.getActivePlayerCount();
    const totalPlayers = config.initialPlayerCount;
    const retiredPlayers = totalPlayers - activePlayers;

    // Calculate total progression funds from active runs
    const activeRuns = this.runOrchestrator.getAllActiveRuns();
    const totalProgressionFunds = activeRuns.reduce((sum, dollar) => {
      return sum + dollar.currentRunWinnings;
    }, 0);

    return {
      totalPlayers,
      activePlayers,
      retiredPlayers,
      totalDonationsFunds: totalDonationFunds,
      totalWinningsFunds: totalWinningsFunds,
      totalProgressionFunds: totalProgressionFunds,
      averageGamesPerPlayer: 0, // Will be calculated by caller with game data
      playerRetirementRate: retiredPlayers / totalPlayers,
    };
  }
}
