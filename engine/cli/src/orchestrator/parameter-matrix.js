// Parameter matrix generation and validation for dataset orchestrator
// Create the parameter matrix definition
export function createParameterMatrix() {
    return {
        growthRates: [15, 35, 60],
        riskLevels: ['low', 'mid', 'high'],
        charityPercentages: [10, 20, 30]
    };
}
// Generate all 27 parameter combinations
export function generateAllCombinations() {
    const matrix = createParameterMatrix();
    const combinations = [];
    for (const growthRate of matrix.growthRates) {
        for (const riskLevel of matrix.riskLevels) {
            for (const charityPercentage of matrix.charityPercentages) {
                combinations.push({
                    growthRate,
                    riskLevel,
                    charityPercentage
                });
            }
        }
    }
    return combinations;
}
// Validate a single parameter combination
export function validateParameterCombination(combination) {
    const matrix = createParameterMatrix();
    // Validate growth rate
    if (!matrix.growthRates.includes(combination.growthRate)) {
        return false;
    }
    // Validate risk level
    if (!matrix.riskLevels.includes(combination.riskLevel)) {
        return false;
    }
    // Validate charity percentage
    if (!matrix.charityPercentages.includes(combination.charityPercentage)) {
        return false;
    }
    return true;
}
// Comprehensive validation with detailed results
export function validateParameterCombinationDetailed(combination) {
    const errors = [];
    const warnings = [];
    const matrix = createParameterMatrix();
    // Validate growth rate
    if (!matrix.growthRates.includes(combination.growthRate)) {
        errors.push(`Invalid growth rate: ${combination.growthRate}. Must be one of: ${matrix.growthRates.join(', ')}`);
    }
    // Validate risk level
    if (!matrix.riskLevels.includes(combination.riskLevel)) {
        errors.push(`Invalid risk level: ${combination.riskLevel}. Must be one of: ${matrix.riskLevels.join(', ')}`);
    }
    // Validate charity percentage
    if (!matrix.charityPercentages.includes(combination.charityPercentage)) {
        errors.push(`Invalid charity percentage: ${combination.charityPercentage}. Must be one of: ${matrix.charityPercentages.join(', ')}`);
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}
// Create default orchestrator configuration
export function createDefaultOrchestratorConfig(overrides) {
    const defaults = {
        outputDirectory: 'engine/generated-datasets',
        generateMetadata: true,
        batchSize: 1, // Sequential processing to avoid resource conflicts
        timeoutPerDataset: 300000, // 5 minutes per dataset
        enableProgressReporting: true,
        enableValidation: true,
        verbose: false,
        dryRun: false
    };
    const config = { ...defaults, ...overrides };
    // Validate configuration
    validateOrchestratorConfig(config);
    return config;
}
// Validate orchestrator configuration
function validateOrchestratorConfig(config) {
    if (config.batchSize < 1) {
        throw new Error('Batch size must be positive');
    }
    if (config.timeoutPerDataset <= 0) {
        throw new Error('Timeout must be positive');
    }
    if (!config.outputDirectory || config.outputDirectory.trim() === '') {
        throw new Error('Output directory cannot be empty');
    }
}
// Generate directory name for parameter combination
export function generateDirectoryName(combination) {
    return `growth-${combination.growthRate}_risk-${combination.riskLevel}_charity-${combination.charityPercentage}`;
}
// Generate file paths for a parameter combination
export function generateFilePaths(outputDirectory, combination) {
    const dirName = generateDirectoryName(combination);
    const basePath = `${outputDirectory}/anchor-datasets/${dirName}`;
    return {
        directory: basePath,
        datasetFile: `${basePath}/dataset.json`,
        metadataFile: `${basePath}/metadata.json`
    };
}
// Parse directory name back to parameter combination (for validation/debugging)
export function parseDirectoryName(directoryName) {
    const pattern = /^growth-(\d+)_risk-(\w+)_charity-(\d+)$/;
    const match = directoryName.match(pattern);
    if (!match) {
        return null;
    }
    const [, growthRateStr, riskLevel, charityPercentageStr] = match;
    const growthRate = parseInt(growthRateStr, 10);
    const charityPercentage = parseInt(charityPercentageStr, 10);
    const combination = {
        growthRate: growthRate,
        riskLevel: riskLevel,
        charityPercentage: charityPercentage
    };
    // Validate parsed combination
    if (!validateParameterCombination(combination)) {
        return null;
    }
    return combination;
}
//# sourceMappingURL=parameter-matrix.js.map