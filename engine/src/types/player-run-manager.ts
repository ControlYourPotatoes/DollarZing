// Player Run Manager Interface
// Defines the interface for managing player runs and progression

import {
  CashOutStrategy,
  VirtualDollar,
  GameResult,
} from "./virtual-dollar-engine";

/**
 * Result of processing a game result
 */
export interface GameResultProcessingResult {
  completionType: "CASH_OUT" | "JACKPOT" | "LOSS";
  totalWinnings: number;
  playerId: string;
  shouldCreateNewRun: boolean;
}

/**
 * Player Run Manager Interface
 * Handles player lifecycle, run creation, and game result processing
 */
export interface PlayerRunManager {
  /**
   * Initialize a new player
   */
  initializePlayer(
    playerId: string,
    initialDonationAmount: number,
    cashOutStrategy: CashOutStrategy
  ): void;

  /**
   * Get the number of active players
   */
  getActivePlayerCount(): number;

  /**
   * Get all active runs
   */
  getAllActiveRuns(): VirtualDollar[];

  /**
   * Process a game result for a virtual dollar
   */
  processGameResult(
    virtualDollar: VirtualDollar,
    result: GameResult
  ): GameResultProcessingResult | null;

  /**
   * Get player strategy
   */
  getPlayerStrategy(playerId: string): CashOutStrategy;

  /**
   * Create a new run for a player
   */
  createNewRun(request: {
    playerId: string;
    cashOutStrategy: CashOutStrategy;
    fundingSource: "DONATION" | "WINNINGS";
  }): VirtualDollar | null;

  /**
   * Auto-create runs for eligible players
   */
  autoCreateRuns(maxRunsPerPlayer?: number): VirtualDollar[];
}
