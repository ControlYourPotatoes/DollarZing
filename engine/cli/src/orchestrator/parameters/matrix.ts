// Parameter matrix generation for dataset orchestrator

import type {
  ParameterMatrix,
  ParameterCombination,
  GrowthRateLevel,
  RiskLevel,
  CharityPercentageLevel,
  DatasetArtifactPaths
} from '../core/types';
import { validateParameterCombination } from './validation';

// Create the parameter matrix definition
export function createParameterMatrix(): ParameterMatrix {
  return {
    growthRates: [15, 35, 60] as const,
    riskLevels: ['low', 'mid', 'high'] as const,
    charityPercentages: [10, 20, 30] as const
  };
}

// Generate all 27 parameter combinations
export function generateAllCombinations(): ParameterCombination[] {
  const matrix = createParameterMatrix();
  const combinations: ParameterCombination[] = [];
  
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

// Generate directory name for parameter combination
export function generateDirectoryName(combination: ParameterCombination): string {
  return `growth-${combination.growthRate}_risk-${combination.riskLevel}_charity-${combination.charityPercentage}`;
}

// Generate file paths for a parameter combination
export function generateFilePaths(
  outputDirectory: string,
  combination: ParameterCombination
): DatasetArtifactPaths {
  const dirName = generateDirectoryName(combination);
  const basePath = `${outputDirectory}/anchor-datasets/${dirName}`;
  
  return {
    directory: basePath,
    datasetFile: `${basePath}/dataset.json`,
    metadataFile: `${basePath}/metadata.json`,
    snapshotsFile: `${basePath}/daily-snapshots.json`,
    eventsFile: `${basePath}/events.ndjson`,
    presentationFile: `${basePath}/presentation-snapshots.json`
  };
}

// Parse directory name back to parameter combination (for validation/debugging)
export function parseDirectoryName(directoryName: string): ParameterCombination | null {
  const pattern = /^growth-(\d+)_risk-(\w+)_charity-(\d+)$/;
  const match = directoryName.match(pattern);
  
  if (!match) {
    return null;
  }
  
  const [, growthRateStr, riskLevel, charityPercentageStr] = match;
  const growthRate = parseInt(growthRateStr, 10);
  const charityPercentage = parseInt(charityPercentageStr, 10);
  
  const combination: ParameterCombination = {
    growthRate: growthRate as GrowthRateLevel,
    riskLevel: riskLevel as RiskLevel,
    charityPercentage: charityPercentage as CharityPercentageLevel
  };
  
  // Validate parsed combination
  if (!validateParameterCombination(combination)) {
    return null;
  }
  
  return combination;
}
