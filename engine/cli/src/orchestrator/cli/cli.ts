// CLI interface for dataset generation orchestrator using Commander.js

import { Command } from 'commander';
import type { OrchestratorConfig } from '../core/types';
import { createDefaultOrchestratorConfig } from '../core/config';

// Create and configure the CLI program
export function createCliProgram(): Command {
  const program = new Command();
  
  program
    .name('orchestrator')
    .description('Generate 27 anchor datasets for the curated dataset system by running the game engine with different parameter combinations')
    .version('1.0.0');

  // Output configuration
  program
    .option('-o, --output <dir>', 'Output directory for generated datasets', 'engine/generated-datasets')
    .option('--no-metadata', 'Disable metadata file generation')
    .option('--no-snapshots', 'Skip writing daily snapshot aggregates')
    .option('--no-events', 'Skip writing event trace logs')
    .option('--no-presentation', 'Skip writing presentation snapshots');

  // Processing configuration  
  program
    .option('-b, --batch-size <size>', 'Number of datasets to process concurrently (1 = sequential)', '1')
    .option('-t, --timeout <ms>', 'Timeout per dataset generation in milliseconds', '300000');

  // Reporting configuration
  program
    .option('--no-progress', 'Disable progress reporting')
    .option('--no-validation', 'Disable dataset validation');
    
  // CLI configuration
  program
    .option('-v, --verbose', 'Enable verbose output', false)
    .option('--dry-run', 'Show what would be generated without actually running', false);

  // Help examples
  program.addHelpText('after', `
Examples:
  $ npm run orchestrator                           # Generate all 27 datasets with defaults
  $ npm run orchestrator --output custom/path     # Use custom output directory
  $ npm run orchestrator --batch-size 3 --verbose # Process 3 datasets concurrently with verbose output
  $ npm run orchestrator --dry-run                # Preview what would be generated
  $ npm run orchestrator --timeout 600000         # Set 10-minute timeout per dataset
`);

  return program;
}

// Parse CLI arguments and return orchestrator configuration
export function parseCliArguments(argv: string[]): OrchestratorConfig {
  const program = createCliProgram();
  
  // Handle help flag without throwing
  if (argv.includes('--help') || argv.includes('-h')) {
    program.outputHelp();
    throw new Error('Help requested');
  }
  
  try {
    program.parse(argv);
    const options = program.opts();
    
    // Convert CLI options to orchestrator configuration
    const config: OrchestratorConfig = {
      outputDirectory: options.output || 'engine/generated-datasets',
      generateMetadata: options.metadata !== false, // Default true unless --no-metadata
      batchSize: parseInt(options.batchSize || '1', 10),
      timeoutPerDataset: parseInt(options.timeout || '300000', 10),
      enableProgressReporting: options.progress !== false, // Default true unless --no-progress
      enableValidation: options.validation !== false, // Default true unless --no-validation
      verbose: options.verbose || false,
      dryRun: options.dryRun || false,
      collectDailySnapshots: options.snapshots !== false,
      collectEventTraces: options.events !== false,
      collectPresentationSnapshots: options.presentation !== false
    };
    
    // Validate the resulting configuration
    validateCliConfiguration(config);
    
    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`CLI parsing failed: ${error.message}`);
    }
    throw error;
  }
}

// Comprehensive CLI configuration validation with detailed error messages
export function validateCliConfiguration(config: OrchestratorConfig): void {
  const errors: string[] = [];
  
  // Validate output directory
  if (!config.outputDirectory || config.outputDirectory.trim() === '') {
    errors.push('Output directory cannot be empty');
  }
  
  // Validate batch size
  if (config.batchSize < 1) {
    errors.push('Batch size must be positive');
  }
  
  if (config.batchSize > 27) {
    errors.push('Batch size cannot exceed 27 (total number of combinations)');
  }
  
  // Validate timeout
  if (config.timeoutPerDataset <= 0) {
    errors.push('Timeout must be positive');
  }
  
  if (config.timeoutPerDataset < 10000) {
    errors.push('Timeout should be at least 10 seconds (10000ms)');
  }
  
  // Warn about extreme values
  if (config.timeoutPerDataset > 3600000) { // 1 hour
    console.warn('Warning: Timeout is set to more than 1 hour per dataset');
  }
  
  if (config.batchSize > 10) {
    console.warn('Warning: High batch size may cause resource contention');
  }
  
  // Throw aggregated errors
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.map(e => `- ${e}`).join('\n')}`);
  }
}

// Parse CLI arguments with better error handling for production use
export function parseCliArgumentsWithErrorHandling(argv: string[]): OrchestratorConfig {
  try {
    return parseCliArguments(argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error('❌ CLI Configuration Error:');
      console.error(error.message);
      console.error('\nUse --help for usage information.');
    }
    process.exit(1);
  }
}

// Show help information
export function showHelp(): void {
  const program = createCliProgram();
  program.help();
}

// Utility function to display current configuration (for verbose mode)
export function displayConfiguration(config: OrchestratorConfig): void {
  console.log('\n🔧 Orchestrator Configuration:');
  console.log(`  Output Directory: ${config.outputDirectory}`);
  console.log(`  Generate Metadata: ${config.generateMetadata ? 'Yes' : 'No'}`);
  console.log(`  Batch Size: ${config.batchSize} (${config.batchSize === 1 ? 'sequential' : 'concurrent'})`);
  console.log(`  Timeout per Dataset: ${config.timeoutPerDataset}ms (${Math.round(config.timeoutPerDataset / 1000)}s)`);
  console.log(`  Progress Reporting: ${config.enableProgressReporting ? 'Enabled' : 'Disabled'}`);
  console.log(`  Validation: ${config.enableValidation ? 'Enabled' : 'Disabled'}`);
  console.log(`  Verbose: ${config.verbose ? 'Enabled' : 'Disabled'}`);
  console.log(`  Dry Run: ${config.dryRun ? 'Yes' : 'No'}`);
  console.log(`  Daily Snapshots: ${config.collectDailySnapshots ? 'Included' : 'Skipped'}`);
  console.log(`  Event Traces: ${config.collectEventTraces ? 'Included' : 'Skipped'}`);
  console.log(`  Presentation Snapshots: ${config.collectPresentationSnapshots ? 'Included' : 'Skipped'}`);
  console.log('');
}

// Validate that required system dependencies are available
export function validateSystemRequirements(): void {
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  
  if (majorVersion < 18) {
    throw new Error(`Node.js 18+ is required. Current version: ${nodeVersion}`);
  }
  
  // Check available memory (basic check)
  const totalMemory = process.memoryUsage();
  if (totalMemory.heapTotal < 50 * 1024 * 1024) { // 50MB minimum
    console.warn('⚠️  Warning: Low available memory detected. Dataset generation may be slow.');
  }
}

// Create default configuration suitable for CLI use
export function createCliDefaultConfig(): OrchestratorConfig {
  return createDefaultOrchestratorConfig({
    verbose: false, // CLI defaults to non-verbose
    enableProgressReporting: true, // CLI users expect progress
    enableValidation: true // CLI users expect validation
  });
}
