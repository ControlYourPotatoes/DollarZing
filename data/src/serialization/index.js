// Optimized serialization/deserialization for DollarZing simulation datasets
// Handles large yearly datasets with performance optimizations and compression
// Default serialization options
const DEFAULT_SERIALIZATION_OPTIONS = {
    includePlayerJourneys: true,
    includeFinancialFlows: true,
    compressionLevel: 'standard'
};
// Custom JSON replacer for optimized serialization
function createJsonReplacer(options) {
    return function (key, value) {
        // Handle Date objects - convert to ISO string for smaller size
        if (value instanceof Date) {
            return { __date: value.toISOString() };
        }
        // Exclude player journeys if not needed (significant space savings)
        if (!options.includePlayerJourneys && key === 'playerJourneys') {
            return undefined;
        }
        // Exclude financial flows if not needed
        if (!options.includeFinancialFlows && key === 'financialFlows') {
            return undefined;
        }
        // Round floating point numbers to reduce string length
        if (typeof value === 'number' && !Number.isInteger(value)) {
            // Round financial values to 2 decimal places
            if (key.includes('amount') || key.includes('earnings') || key.includes('revenue') || key.includes('winnings')) {
                return Math.round(value * 100) / 100;
            }
            // Round percentages and rates to 4 decimal places
            if (key.includes('rate') || key.includes('percentage') || key.includes('probability')) {
                return Math.round(value * 10000) / 10000;
            }
            // Round other decimals to 3 decimal places
            return Math.round(value * 1000) / 1000;
        }
        return value;
    };
}
// Custom JSON reviver for optimized deserialization
function createJsonReviver() {
    return function (_key, value) {
        // Restore Date objects
        if (value && typeof value === 'object' && value.__date) {
            return new Date(value.__date);
        }
        return value;
    };
}
// Optimized dataset serialization
export function serializeDataset(dataset, options = {}) {
    const startTime = performance.now();
    const mergedOptions = { ...DEFAULT_SERIALIZATION_OPTIONS, ...options };
    // Pre-processing for compression
    let processedDataset = dataset;
    if (mergedOptions.compressionLevel === 'high') {
        processedDataset = compressDataset(dataset);
    }
    // Serialize with custom replacer
    const replacer = createJsonReplacer(mergedOptions);
    const serialized = JSON.stringify(processedDataset, replacer);
    const endTime = performance.now();
    const serializationTime = endTime - startTime;
    // Calculate approximate memory usage
    const memoryUsage = new Blob([serialized]).size / (1024 * 1024); // MB
    return {
        serialized,
        metrics: {
            generationTime: 0, // Not applicable for serialization
            memoryUsage,
            serializationTime,
            deserializationTime: 0
        }
    };
}
// Optimized dataset deserialization
export function deserializeDataset(serialized) {
    const startTime = performance.now();
    // Deserialize with custom reviver
    const reviver = createJsonReviver();
    const dataset = JSON.parse(serialized, reviver);
    const endTime = performance.now();
    const deserializationTime = endTime - startTime;
    // Calculate memory usage
    const memoryUsage = new Blob([serialized]).size / (1024 * 1024); // MB
    return {
        dataset,
        metrics: {
            generationTime: 0, // Not applicable for deserialization
            memoryUsage,
            serializationTime: 0,
            deserializationTime
        }
    };
}
// Dataset compression for high compression level
function compressDataset(dataset) {
    // Create a compressed version by reducing precision and removing redundant data
    const compressed = { ...dataset };
    // Compress daily snapshots
    compressed.dailySnapshots = dataset.dailySnapshots.map(snapshot => ({
        ...snapshot,
        // Keep only essential player journey data for high compression
        playerJourneys: snapshot.playerJourneys.slice(0, Math.min(100, snapshot.playerJourneys.length))
    }));
    // Remove financial flows for high compression (can be regenerated)
    if (compressed.financialFlows) {
        compressed.financialFlows = [];
    }
    return compressed;
}
// Batch serialization for multiple datasets
export function serializeDatasetBatch(datasets, options = {}) {
    const startTime = performance.now();
    let totalMemoryUsage = 0;
    const serializedDatasets = datasets.map(dataset => {
        const { serialized, metrics } = serializeDataset(dataset, options);
        totalMemoryUsage += metrics.memoryUsage;
        return serialized;
    });
    const batch = {
        version: '1.0.0',
        count: datasets.length,
        datasets: serializedDatasets
    };
    const serializedBatch = JSON.stringify(batch);
    const endTime = performance.now();
    return {
        serializedBatch,
        totalMetrics: {
            generationTime: 0,
            memoryUsage: totalMemoryUsage,
            serializationTime: endTime - startTime,
            deserializationTime: 0
        }
    };
}
// Incremental serialization for large datasets
export function serializeDatasetIncremental(dataset, chunkSize = 30, // Days per chunk
options = {}) {
    const startTime = performance.now();
    const chunks = [];
    let totalMemoryUsage = 0;
    // Split daily snapshots into chunks
    const dailyChunks = [];
    for (let i = 0; i < dataset.dailySnapshots.length; i += chunkSize) {
        dailyChunks.push(dataset.dailySnapshots.slice(i, i + chunkSize));
    }
    // Serialize each chunk
    dailyChunks.forEach((chunk, index) => {
        const chunkDataset = {
            ...dataset,
            dailySnapshots: chunk,
            id: `${dataset.id}-chunk-${index}`,
            metadata: {
                ...dataset.metadata,
                dataPoints: chunk.length
            }
        };
        const { serialized, metrics } = serializeDataset(chunkDataset, options);
        chunks.push(serialized);
        totalMemoryUsage += metrics.memoryUsage;
    });
    const endTime = performance.now();
    return {
        chunks,
        totalMetrics: {
            generationTime: 0,
            memoryUsage: totalMemoryUsage,
            serializationTime: endTime - startTime,
            deserializationTime: 0
        }
    };
}
// Dataset size estimation
export function estimateDatasetSize(dataset) {
    // Rough size estimation without full serialization
    const metadataSize = JSON.stringify(dataset.metadata).length;
    const parametersSize = JSON.stringify(dataset.parameters).length;
    // Estimate daily snapshots size
    const sampleSnapshot = dataset.dailySnapshots[0];
    const avgSnapshotSize = sampleSnapshot ? JSON.stringify(sampleSnapshot).length : 1000;
    const dailySnapshotsSize = avgSnapshotSize * dataset.dailySnapshots.length;
    // Estimate aggregations size
    const aggregationsSize = JSON.stringify(dataset.aggregations).length;
    // Estimate player journeys size (usually the largest component)
    const totalPlayerJourneys = dataset.dailySnapshots.reduce((sum, snapshot) => sum + snapshot.playerJourneys.length, 0);
    const avgJourneySize = 500; // Estimated bytes per player journey
    const playerJourneysSize = totalPlayerJourneys * avgJourneySize;
    // Estimate financial flows size
    const financialFlowsSize = dataset.financialFlows ?
        dataset.financialFlows.length * 300 : 0; // Estimated bytes per flow record
    const totalSize = metadataSize + parametersSize + dailySnapshotsSize +
        aggregationsSize + playerJourneysSize + financialFlowsSize;
    return {
        estimatedSizeBytes: totalSize,
        estimatedSizeMB: totalSize / (1024 * 1024),
        breakdown: {
            metadata: metadataSize + parametersSize,
            dailySnapshots: dailySnapshotsSize,
            aggregations: aggregationsSize,
            playerJourneys: playerJourneysSize,
            financialFlows: financialFlowsSize
        }
    };
}
// Performance testing utility
export async function benchmarkSerialization(dataset, iterations = 10) {
    const results = [];
    for (let i = 0; i < iterations; i++) {
        // Serialization benchmark
        const serializeStart = performance.now();
        const { serialized, metrics: serializeMetrics } = serializeDataset(dataset);
        const serializeEnd = performance.now();
        // Deserialization benchmark
        const deserializeStart = performance.now();
        deserializeDataset(serialized);
        const deserializeEnd = performance.now();
        results.push({
            serializationTime: serializeEnd - serializeStart,
            deserializationTime: deserializeEnd - deserializeStart,
            memoryUsage: serializeMetrics.memoryUsage,
            serializedSize: serialized.length
        });
    }
    // Calculate averages
    const avgSerializationTime = results.reduce((sum, r) => sum + r.serializationTime, 0) / iterations;
    const avgDeserializationTime = results.reduce((sum, r) => sum + r.deserializationTime, 0) / iterations;
    const avgMemoryUsage = results.reduce((sum, r) => sum + r.memoryUsage, 0) / iterations;
    const avgSerializedSize = results.reduce((sum, r) => sum + r.serializedSize, 0) / iterations;
    // Calculate compression ratio
    const originalSize = estimateDatasetSize(dataset).estimatedSizeBytes;
    const compressionRatio = originalSize / avgSerializedSize;
    return {
        avgSerializationTime,
        avgDeserializationTime,
        avgMemoryUsage,
        compressionRatio
    };
}
//# sourceMappingURL=index.js.map