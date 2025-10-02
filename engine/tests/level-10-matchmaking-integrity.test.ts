/**
 * Level 10 Matchmaking Integrity Test
 * 
 * Investigation: We're seeing level-10 matches when only one level-9 winner is recorded for that day.
 * This test audits the event flow to confirm that two distinct level-9 winners are required 
 * before a level-10 game is created.
 * 
 * Key Questions:
 * 1. Are level stats missing prior-day carry-overs?
 * 2. Are already-resolved matches being counted?
 * 3. Is there a timing issue where level-9 winners advance to level-10 pool before stats are recorded?
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../src/events/event-bus';
import { MatchmakingEventHandler } from '../src/events/handlers/matchmaking-event-handler';
import { LevelTrackingHandler } from '../src/events/handlers/level-tracking-handler';
import { PlayerProgressionHandler } from '../src/events/handlers/player-progression-handler';
import { GameMatchingEngine } from '../src/core/game-matching-engine';
import { UnifiedVirtualDollarFactory } from '../src/test-utils/direct-factories';
import { DirectGameSessionFactory } from '../src/test-utils/direct-factories';
import { ScoringEngine } from '../src/core/scoring-engine';
import { EVENT_TYPES } from '../src/events/event-types';
import { BettingLevel, DollarState } from '../src/types/virtual-dollar-engine';
import type { VirtualDollarFactory, GameSessionFactory } from '../src/types/factory-interfaces';

describe('Level 10 Matchmaking Integrity', () => {
  let eventBus: EventBus;
  let virtualDollarFactory: VirtualDollarFactory;
  let gameSessionFactory: GameSessionFactory;
  let scoringEngine: ScoringEngine;
  let gameMatchingEngine: GameMatchingEngine;
  let matchmakingHandler: MatchmakingEventHandler;
  let levelTrackingHandler: LevelTrackingHandler;
  let progressionHandler: PlayerProgressionHandler;

  beforeEach(() => {
    eventBus = new EventBus();
    virtualDollarFactory = new UnifiedVirtualDollarFactory();
    scoringEngine = new ScoringEngine({ seed: 12345 });
    gameSessionFactory = new DirectGameSessionFactory(scoringEngine);
    
    gameMatchingEngine = new GameMatchingEngine(
      virtualDollarFactory,
      scoringEngine,
      gameSessionFactory,
      eventBus
    );

    matchmakingHandler = new MatchmakingEventHandler(
      eventBus,
      gameMatchingEngine,
      virtualDollarFactory,
      gameSessionFactory
    );

    levelTrackingHandler = new LevelTrackingHandler(eventBus);
    progressionHandler = new PlayerProgressionHandler(
      eventBus,
      virtualDollarFactory,
      gameMatchingEngine
    );
  });

  afterEach(() => {
    progressionHandler.dispose();
    matchmakingHandler.dispose();
    eventBus.dispose();
  });

  it('should require two distinct level-9 winners before creating a level-10 game', async () => {
    // Start day 1
    await eventBus.emit(EVENT_TYPES.DAY_STARTED, {
      type: EVENT_TYPES.DAY_STARTED,
      timestamp: new Date(),
      dayNumber: 1,
    });

    // Create two players at level 9
    const player1Id = 'player-1';
    const player2Id = 'player-2';
    
    const dollar1 = virtualDollarFactory.create(player1Id, 9 as BettingLevel);
    const dollar2 = virtualDollarFactory.create(player2Id, 9 as BettingLevel);

    // Add both to pool at level 9
    await gameMatchingEngine.addToPool(dollar1);
    await gameMatchingEngine.addToPool(dollar2);

    // Trigger matchmaking - should create a level-9 game
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check level 9 stats
    const day1Stats = levelTrackingHandler.getDailyLevelStats(1);
    const level9Stats = day1Stats.get(9 as BettingLevel);
    
    console.log('Level 9 stats after matchmaking:', level9Stats);
    
    // Should have 1 game at level 9
    expect(level9Stats?.gamesPlayed).toBe(1);

    // Get active games
    const activeGames = gameMatchingEngine.getActiveGames();
    expect(activeGames.length).toBe(1);
    
    const level9Game = activeGames[0];
    expect(level9Game.level).toBe(9);

    // Resolve the level-9 game (player1 wins)
    const resolution = await gameMatchingEngine.resolveGame(level9Game.id);
    expect(resolution.success).toBe(true);

    // Wait for progression events to process
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check level 9 stats after resolution
    const level9StatsAfterResolution = day1Stats.get(9 as BettingLevel);
    console.log('Level 9 stats after resolution:', level9StatsAfterResolution);
    
    // Should have 1 win and 1 progression at level 9
    expect(level9StatsAfterResolution?.wins).toBe(1);
    expect(level9StatsAfterResolution?.progressions).toBe(1);

    // Check if level 10 pool has any dollars
    const level10Dollars = gameMatchingEngine.getDollarsAtLevel(10 as BettingLevel);
    console.log('Level 10 pool after first level-9 win:', level10Dollars.length);
    
    // Should have 1 dollar at level 10 (the winner)
    expect(level10Dollars.length).toBe(1);

    // Check level 10 stats - should have NO games yet
    const level10Stats = day1Stats.get(10 as BettingLevel);
    console.log('Level 10 stats after first level-9 win:', level10Stats);
    
    expect(level10Stats?.gamesPlayed || 0).toBe(0);

    // Now create a second level-9 winner to enable a level-10 match
    const player3Id = 'player-3';
    const player4Id = 'player-4';
    
    const dollar3 = virtualDollarFactory.create(player3Id, 9 as BettingLevel);
    const dollar4 = virtualDollarFactory.create(player4Id, 9 as BettingLevel);

    await gameMatchingEngine.addToPool(dollar3);
    await gameMatchingEngine.addToPool(dollar4);

    // Trigger matchmaking - should create another level-9 game
    await new Promise(resolve => setTimeout(resolve, 100));

    // Resolve the second level-9 game
    const activeGames2 = gameMatchingEngine.getActiveGames();
    const level9Game2 = activeGames2.find(g => g.level === 9);
    expect(level9Game2).toBeDefined();

    const resolution2 = await gameMatchingEngine.resolveGame(level9Game2!.id);
    expect(resolution2.success).toBe(true);

    // Wait for progression
    await new Promise(resolve => setTimeout(resolve, 100));

    // Now we should have 2 dollars at level 10
    const level10DollarsAfterSecondWin = gameMatchingEngine.getDollarsAtLevel(10 as BettingLevel);
    console.log('Level 10 pool after second level-9 win:', level10DollarsAfterSecondWin.length);
    
    expect(level10DollarsAfterSecondWin.length).toBe(2);

    // Trigger matchmaking - should now create a level-10 game
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check level 10 stats
    const level10StatsAfterMatch = day1Stats.get(10 as BettingLevel);
    console.log('Level 10 stats after matchmaking:', level10StatsAfterMatch);
    
    // Should have 1 game at level 10
    expect(level10StatsAfterMatch?.gamesPlayed).toBe(1);

    // Check level 9 stats - should have 2 progressions
    const level9StatsFinal = day1Stats.get(9 as BettingLevel);
    console.log('Level 9 stats final:', level9StatsFinal);
    
    expect(level9StatsFinal?.progressions).toBe(2);
  });

  it('should track level-9 progressions separately from level-10 games', async () => {
    // This test verifies that the stats correctly distinguish between:
    // - Level 9 games played (matches at level 9)
    // - Level 9 progressions (winners who advance to level 10)
    // - Level 10 games played (matches at level 10)

    await eventBus.emit(EVENT_TYPES.DAY_STARTED, {
      type: EVENT_TYPES.DAY_STARTED,
      timestamp: new Date(),
      dayNumber: 1,
    });

    // Track events
    const gameCreatedEvents: any[] = [];
    const gameResolvedEvents: any[] = [];
    
    eventBus.on(EVENT_TYPES.GAME_CREATED, (event) => {
      gameCreatedEvents.push(event);
      console.log(`GAME_CREATED: level ${event.player1Level}, game ${event.gameId}`);
    });

    eventBus.on(EVENT_TYPES.GAME_RESOLVED, (event) => {
      gameResolvedEvents.push(event);
      console.log(`GAME_RESOLVED: level ${event.winnerLevel}, winner ${event.winnerId}`);
    });

    // Create 4 players at level 9
    const players = ['p1', 'p2', 'p3', 'p4'];
    const dollars = players.map(pid => virtualDollarFactory.create(pid, 9 as BettingLevel));

    // Add all to pool
    for (const dollar of dollars) {
      await gameMatchingEngine.addToPool(dollar);
    }

    // Wait for matchmaking
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should have 2 level-9 games
    const level9GamesCreated = gameCreatedEvents.filter(e => e.player1Level === 9);
    console.log('Level 9 games created:', level9GamesCreated.length);
    expect(level9GamesCreated.length).toBe(2);

    // Resolve both level-9 games
    const activeGames = gameMatchingEngine.getActiveGames();
    for (const game of activeGames) {
      if (game.level === 9) {
        await gameMatchingEngine.resolveGame(game.id);
      }
    }

    // Wait for progression
    await new Promise(resolve => setTimeout(resolve, 150));

    // Check stats
    const day1Stats = levelTrackingHandler.getDailyLevelStats(1);
    const level9Stats = day1Stats.get(9 as BettingLevel);
    const level10Stats = day1Stats.get(10 as BettingLevel);

    console.log('Level 9 stats:', level9Stats);
    console.log('Level 10 stats:', level10Stats);

    // Level 9: 2 games, 2 wins, 2 progressions
    expect(level9Stats?.gamesPlayed).toBe(2);
    expect(level9Stats?.wins).toBe(2);
    expect(level9Stats?.progressions).toBe(2);

    // Level 10: 1 game (the two level-9 winners matched)
    expect(level10Stats?.gamesPlayed).toBe(1);

    // Verify event sequence
    const level9Resolved = gameResolvedEvents.filter(e => e.winnerLevel === 9);
    const level10Created = gameCreatedEvents.filter(e => e.player1Level === 10);
    
    console.log('Level 9 resolved events:', level9Resolved.length);
    console.log('Level 10 created events:', level10Created.length);

    expect(level9Resolved.length).toBe(2);
    expect(level10Created.length).toBe(1);
  });

  it('should handle cross-day level-9 winners correctly', async () => {
    // This test checks if level-9 winners from previous days can match with
    // new level-9 winners on the current day

    // Day 1: Create one level-9 winner
    await eventBus.emit(EVENT_TYPES.DAY_STARTED, {
      type: EVENT_TYPES.DAY_STARTED,
      timestamp: new Date(),
      dayNumber: 1,
    });

    const p1 = virtualDollarFactory.create('p1', 9 as BettingLevel);
    const p2 = virtualDollarFactory.create('p2', 9 as BettingLevel);

    await gameMatchingEngine.addToPool(p1);
    await gameMatchingEngine.addToPool(p2);
    await new Promise(resolve => setTimeout(resolve, 100));

    const day1Games = gameMatchingEngine.getActiveGames();
    await gameMatchingEngine.resolveGame(day1Games[0].id);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check day 1 stats
    const day1Stats = levelTrackingHandler.getDailyLevelStats(1);
    const day1Level9 = day1Stats.get(9 as BettingLevel);
    const day1Level10 = day1Stats.get(10 as BettingLevel);

    console.log('Day 1 - Level 9:', day1Level9);
    console.log('Day 1 - Level 10:', day1Level10);

    expect(day1Level9?.progressions).toBe(1);
    expect(day1Level10?.gamesPlayed || 0).toBe(0);

    // Day 2: Create another level-9 winner
    await eventBus.emit(EVENT_TYPES.DAY_STARTED, {
      type: EVENT_TYPES.DAY_STARTED,
      timestamp: new Date(),
      dayNumber: 2,
    });

    const p3 = virtualDollarFactory.create('p3', 9 as BettingLevel);
    const p4 = virtualDollarFactory.create('p4', 9 as BettingLevel);

    await gameMatchingEngine.addToPool(p3);
    await gameMatchingEngine.addToPool(p4);
    await new Promise(resolve => setTimeout(resolve, 100));

    const day2Games = gameMatchingEngine.getActiveGames().filter(g => g.level === 9);
    if (day2Games.length > 0) {
      await gameMatchingEngine.resolveGame(day2Games[0].id);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check day 2 stats
    const day2Stats = levelTrackingHandler.getDailyLevelStats(2);
    const day2Level9 = day2Stats.get(9 as BettingLevel);
    const day2Level10 = day2Stats.get(10 as BettingLevel);

    console.log('Day 2 - Level 9:', day2Level9);
    console.log('Day 2 - Level 10:', day2Level10);

    // Day 2 should show the level-10 game (from day 1 winner + day 2 winner)
    expect(day2Level10?.gamesPlayed).toBe(1);

    // But the level-9 progression should only count the day 2 winner
    expect(day2Level9?.progressions).toBe(1);
  });
});
