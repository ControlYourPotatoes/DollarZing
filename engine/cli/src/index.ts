#!/usr/bin/env node
// Main CLI Entry Point for DollarZing Engine Tools
// Provides a clean command structure for all engine operations

import { Command } from 'commander';
import { createSimpleTestCommand } from './commands/simple-test.js';
import { createTestGameCommand } from './commands/test-game.js';

/**
 * Main CLI program
 */
function createMainProgram(): Command {
  const program = new Command();

  program
    .name('dollarzing')
    .description('DollarZing simulation engine CLI tools')
    .version('1.0.0');

  // Add commands
  program.addCommand(createSimpleTestCommand());
  program.addCommand(createTestGameCommand());

  // Global error handling
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
    writeOut: (str) => process.stdout.write(str)
  });

  return program;
}

/**
 * Handle CLI execution
 */
async function main(): Promise<void> {
  try {
    const program = createMainProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('💥 CLI Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Handle unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled promise rejection:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received interrupt signal. Shutting down gracefully...');
  process.exit(0);
});

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Fatal CLI error:', error);
    process.exit(1);
  });
}

export { createMainProgram };