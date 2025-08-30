import { VirtualDollar, GameSession, BettingLevel } from './virtual-dollar-engine';
import { VirtualDollarFactory, GameSessionFactory, GamePair, FactoryStatistics, PerformanceConfig } from './factory-interfaces';
/**
 * PooledVirtualDollarFactory - Implementation using object pooling for performance
 * Utilizes the existing VirtualDollarPool for memory-efficient object management
 */
export declare class PooledVirtualDollarFactory implements VirtualDollarFactory {
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
 * PooledGameSessionFactory - Implementation using object pooling for performance
 * Utilizes the existing GameSessionPool for memory-efficient object management
 */
export declare class PooledGameSessionFactory implements GameSessionFactory {
    private objectsCreated;
    private objectsReleased;
    private gameCounter;
    private performanceTracker;
    private config;
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
}
//# sourceMappingURL=pooled-factories.d.ts.map