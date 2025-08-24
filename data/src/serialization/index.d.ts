import { SimulationDataset, SerializationOptions, PerformanceMetrics } from '../types/index';
export declare function serializeDataset(dataset: SimulationDataset, options?: Partial<SerializationOptions>): {
    serialized: string;
    metrics: PerformanceMetrics;
};
export declare function deserializeDataset(serialized: string): {
    dataset: SimulationDataset;
    metrics: PerformanceMetrics;
};
export declare function serializeDatasetBatch(datasets: SimulationDataset[], options?: Partial<SerializationOptions>): {
    serializedBatch: string;
    totalMetrics: PerformanceMetrics;
};
export declare function serializeDatasetIncremental(dataset: SimulationDataset, chunkSize?: number, // Days per chunk
options?: Partial<SerializationOptions>): {
    chunks: string[];
    totalMetrics: PerformanceMetrics;
};
export declare function estimateDatasetSize(dataset: SimulationDataset): {
    estimatedSizeBytes: number;
    estimatedSizeMB: number;
    breakdown: {
        metadata: number;
        dailySnapshots: number;
        aggregations: number;
        playerJourneys: number;
        financialFlows: number;
    };
};
export declare function benchmarkSerialization(dataset: SimulationDataset, iterations?: number): Promise<{
    avgSerializationTime: number;
    avgDeserializationTime: number;
    avgMemoryUsage: number;
    compressionRatio: number;
}>;
//# sourceMappingURL=index.d.ts.map