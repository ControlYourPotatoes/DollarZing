import { VirtualDollar, GameSession, BettingLevel } from './virtual-dollar-engine';
import { VirtualDollarFactory, GameSessionFactory, GamePair, FactoryStatistics, PerformanceConfig } from './factory-interfaces';
/**
 * DirectVirtualDollarFactory - Implementation using direct object creation
 * Creates objects directly without pooling, ideal for development and testing
 */
export declare class DirectVirtualDollarFactory implements VirtualDollarFactory {
    private objectsCreated;
    private objectsReleased;
    private performanceTracker;
    private config;
    constructor(config: PerformanceConfig);
    create(playerId: string): VirtualDollar;
    release(dollar: VirtualDollar): void;
    createBatch(playerIds: string[]): VirtualDollar[];
    getStatistics(): FactoryStatistics;
    /**
     * Reset factory statistics (useful for testing)
     */
    resetStatistics(): void;
    private generateUniqueId;
    private generateRunId;
    private generateSerialNumber;
}
/**
 * DirectGameSessionFactory - Implementation using direct object creation
 * Creates game sessions directly without pooling, ideal for development and testing
 */
export declare class DirectGameSessionFactory implements GameSessionFactory {
    private objectsCreated;
    private objectsReleased;
    private gameCounter;
    private performanceTracker;
    private config;
    private emptyDollar;
    constructor(config: PerformanceConfig);
    create(dollar1: VirtualDollar, dollar2: VirtualDollar, level: BettingLevel): GameSession;
    release(session: GameSession): void;
    createBatch(pairs: GamePair[]): GameSession[];
    getStatistics(): FactoryStatistics;
    /**
     * Reset factory statistics (useful for testing)
     */
    resetStatistics(): void;
    private calculateWinnings;
    /**
     * Generate current daily seed in YYYY-MM-DD format
     */
    private getCurrentDailySeed;
    /**
     * Generate deterministic random seed from game ID
     */
    private generateDeterministicSeed;
}
//# sourceMappingURL=direct-factories.d.ts.map