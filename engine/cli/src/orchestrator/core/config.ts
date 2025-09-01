// Configuration utilities for dataset orchestrator

import type {
  OrchestratorConfig,
  OrchestratorConfigOverrides
} from './types';
import { validateOrchestratorConfig } from '../parameters/validation';

// Create default orchestrator configuration
export function createDefaultOrchestratorConfig(overrides?: OrchestratorConfigOverrides): OrchestratorConfig {
  const defaults: OrchestratorConfig = {
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