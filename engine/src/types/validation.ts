import { SimulationParameters, DatasetValidationResult } from './simulation-types';

// Parameter validation (engine-specific, no government)
export function validateSimulationParameters(params: SimulationParameters): DatasetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Adoption rate validation
  if (params.adoptionRate < 0 || params.adoptionRate > 1) {
    errors.push('Adoption rate must be between 0 and 1');
  } else if (params.adoptionRate > 0.5) {
    warnings.push('Adoption rate above 50% may be unrealistic');
  }

  // Growth multiplier validation
  if (params.growthMultiplier < 0) {
    errors.push('Growth multiplier cannot be negative');
  } else if (params.growthMultiplier > 5) {
    warnings.push('Growth multiplier above 5x may lead to unrealistic projections');
  }

  // Cash out strategy validation
  const validStrategies = ['low', 'average', 'high'];
  if (!validStrategies.includes(params.cashOutStrategy)) {
    errors.push('Cash out strategy must be one of: low, average, high');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}