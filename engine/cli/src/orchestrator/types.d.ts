export type GrowthRateLevel = 15 | 35 | 60;
export type RiskLevel = 'low' | 'mid' | 'high';
export type CharityPercentageLevel = 10 | 20 | 30;
export interface ParameterMatrix {
    readonly growthRates: readonly [15, 35, 60];
    readonly riskLevels: readonly ['low', 'mid', 'high'];
    readonly charityPercentages: readonly [10, 20, 30];
}
export interface ParameterCombination {
    growthRate: GrowthRateLevel;
    riskLevel: RiskLevel;
    charityPercentage: CharityPercentageLevel;
}
export interface OrchestratorConfig {
    outputDirectory: string;
    generateMetadata: boolean;
    batchSize: number;
    timeoutPerDataset: number;
    enableProgressReporting: boolean;
    enableValidation: boolean;
    verbose: boolean;
    dryRun: boolean;
}
export type OrchestratorConfigOverrides = Partial<OrchestratorConfig>;
export interface OrchestrationProgress {
    totalCombinations: number;
    completedCombinations: number;
    currentCombination: ParameterCombination | null;
    completionPercentage: number;
    elapsedTimeMs: number;
    estimatedRemainingMs: number;
    failedCombinations: ParameterCombination[];
    successfulCombinations: ParameterCombination[];
}
export interface DatasetGenerationResult {
    combination: ParameterCombination;
    success: boolean;
    error?: string;
    outputPath?: string;
    metadataPath?: string;
    generationTimeMs: number;
    datasetSizeBytes?: number;
}
export interface OrchestrationResults {
    totalProcessed: number;
    successful: number;
    failed: number;
    totalTimeMs: number;
    results: DatasetGenerationResult[];
    outputDirectory: string;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface DatasetMetadata {
    generationTimestamp: Date;
    parameters: ParameterCombination;
    generationTimeMs: number;
    datasetSizeBytes: number;
    recordCount: number;
    version: string;
    generatorVersion: string;
}
export interface FileNamingConfig {
    datasetFilename: string;
    metadataFilename: string;
    directoryNamePattern: string;
}
//# sourceMappingURL=types.d.ts.map