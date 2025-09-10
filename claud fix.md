✗ Auto-update failed · Try claude doctor or npm i -g @anthropic-ai/claude-code


Task 8.5: Remove Duplicate Business Logic Analysis

  Current Duplicate Business Logic:

  1. Duplicate Player Creation (PlayerManager)

  // Lines 111-122: PlayerManager creates players in TWO places!
  this.playerBalanceManager.createPlayer(playerId, 100, selectedStrategy);
  this.runOrchestrator.initializePlayer(playerId, 100, selectedStrategy);
  Problem: Same player data stored in 2 different managers

  2. Duplicate Game Processing (DayProcessor)

  // Lines 203-206: Legacy direct game result processing
  const winnerResult = this.playerManager.processGameResult(winner, GameResult.WIN);
  Problem: DayProcessor is doing game processing that should be handled by:
  - GameEventHandler → emits GAME_RESOLVED events
  - PlayerProgressionHandler → handles progression
  - CashOutDecisionHandler → handles cash-out decisions

  3. Mixed Legacy + Event Systems

  - Event handlers are initialized but legacy code still bypasses them
  - Creates dual execution paths

  Implementation Plan for Task 8.5:

  Fix 1: PlayerManager - Remove Duplicate Player Creation

  File: /workspace/engine/src/simulation/player-manager.ts

  // REMOVE lines 111-122: Dual player creation
  // REPLACE with single player state management

  // Replace dual creation with single player registry
  private playerRegistry = new Map<string, {
    id: string;
    strategy: CashOutStrategy;
    initialDonation: number;
    createdAt: Date;
  }>();

  // In handleDayStarted(), replace dual creation with:
  this.playerRegistry.set(playerId, {
    id: playerId,
    strategy: selectedStrategy,
    initialDonation: 100,
    createdAt: new Date()
  });

  Fix 2: DayProcessor - Remove Legacy Game Processing

  File: /workspace/engine/src/simulation/day-processor.ts

  // REMOVE lines 203-242: All legacy game result processing
  // REPLACE with pure event emission

  // Replace processGameResults() with:
  private async processGameResults(games: any[]): Promise<void> {
    for (const gameSession of games) {
      if (gameSession.winner && gameSession.loser) {
        // Emit GAME_RESOLVED event - let event handlers do the work
        await this.eventBus.emit(EVENT_TYPES.GAME_RESOLVED, {
          type: EVENT_TYPES.GAME_RESOLVED,
          timestamp: new Date(),
          gameId: gameSession.id,
          winnerId: gameSession.winner.ownerId,
          winnerDollarId: gameSession.winner.id,
          winnerLevel: gameSession.winner.currentLevel,
          loserId: gameSession.loser.ownerId,
          loserDollarId: gameSession.loser.id,
          loserLevel: gameSession.loser.currentLevel,
        } as GameResolvedEvent);
      }
    }
  }

  Fix 3: Ensure Event Handlers Process Everything

  The existing event handlers should handle all game logic:
  - ✅ GameEventHandler - Already emits GAME_RESOLVED
  - ✅ PlayerProgressionHandler - Already listens to GAME_RESOLVED
  - ✅ CashOutDecisionHandler - Already handles cash-out decisions
  - ✅ PoolManagementHandler - Already handles re-pooling

  Result: Pure Event-Driven Flow

  New Flow:
  1. DayProcessor emits GAME_RESOLVED events
  2. Event handlers process all game logic through events
  3. No direct method calls between components
  4. Single execution path through event system

  Should I proceed with these changes to eliminate the duplicate business logic?

  Todos
  ☒ Fix charity percentage flow to all event handlers (remove hardcoded 0.1 ProgressionManager)
  ☒ Implement S-curve growth model integration with player spawning (Conservative/Market/Viral growth)
  ☒ Update risk/strategy distribution to flow from dataset parameters to event handlers
  ☒ Update PlayerManager to handle VirtualDollar allocation and growth model integration
  ☐ Remove duplicate business logic between legacy and event-driven systems
  ☐ Verify all parameters flow correctly per-dataset (27 configuration matrix)
  ☐ Test end-to-end parameter flow from DatasetOrchestrator to event handlers
  ☐ Validate 3x3x3 configuration matrix: Growth(Conservative/Market/Viral) × Risk(low/mid/high) × Charity(10%/20%/30%)