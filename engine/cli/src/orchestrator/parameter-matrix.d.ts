import type { ParameterMatrix, ParameterCombination, OrchestratorConfig, OrchestratorConfigOverrides, ValidationResult } from './types';
export declare function createParameterMatrix(): ParameterMatrix;
export declare function generateAllCombinations(): ParameterCombination[];
export declare function validateParameterCombination(combination: ParameterCombination): boolean;
export declare function validateParameterCombinationDetailed(combination: ParameterCombination): ValidationResult;
export declare function createDefaultOrchestratorConfig(overrides?: OrchestratorConfigOverrides): OrchestratorConfig;
export declare function generateDirectoryName(combination: ParameterCombination): string;
export declare function generateFilePaths(outputDirectory: string, combination: ParameterCombination): {
    directory: string;
    datasetFile: string;
    metadataFile: string;
};
export declare function parseDirectoryName(directoryName: string): ParameterCombination | null;
//# sourceMappingURL=parameter-matrix.d.ts.map