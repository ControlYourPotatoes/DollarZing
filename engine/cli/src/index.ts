#!/usr/bin/env node
// Main CLI Entry Point for DollarZing Engine Tools
// Provides a clean command structure for all engine operations

import { Command } from "commander";
import { createSimpleTestCommand } from "./commands/simple-test.js";
import { createTestGameCommand } from "./commands/test-game.js";
import { createSimulateCommand } from "./commands/simulate.js";

/**
 * Main CLI program
 */
function createMainProgram(): Command {
  const program = new Command();

  program
    .name("dollarzing")
    .description("DollarZing simulation engine CLI tools")
    .version("1.0.0");

  // Add commands
  program.addCommand(createSimpleTestCommand());
  program.addCommand(createTestGameCommand());
  program.addCommand(createSimulateCommand());

  // Default action when no command is provided
  program.action(() => {
    console.log("🎯 DollarZing Engine CLI");
    console.log("========================");
    console.log("");
    console.log("Available commands:");
    console.log("  simple-test    - Simple test to verify CLI is working");
    console.log(
      "  test-game      - Run a single game simulation for testing and debugging"
    );
    console.log(
      "  simulate       - Run configurable multi-day simulations"
    );
    console.log("");
    console.log("Usage examples:");
    console.log("  dollarzing simple-test");
    console.log("  dollarzing test-game");
    console.log("");
    console.log("💡 This container is now running in CLI mode.");
    console.log("   Use docker-compose exec to run commands:");
    console.log("   docker-compose exec engine dollarzing simple-test");
    console.log("");
    console.log("🔄 Container will stay running for CLI access.");
    console.log(
      "   Press Ctrl+C to exit or let it run for docker-compose exec."
    );

    // Keep the process alive for CLI access
    // Use a more reliable method for Docker containers
    const keepAlive = () => {
      // This keeps the process alive indefinitely
      setTimeout(keepAlive, 1000);
    };
    keepAlive();

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Shutting down CLI container...");
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
      process.exit(0);
    });
  });

  // Global error handling
  program.configureOutput({
    writeErr: (str) => process.stderr.write(str),
    writeOut: (str) => process.stdout.write(str),
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
    console.error(
      "💥 CLI Error:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

// Handle unhandled promises and exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled promise rejection:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught exception:", error);
  process.exit(1);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Received interrupt signal. Shutting down gracefully...");
  process.exit(0);
});

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("💥 Fatal CLI error:", error);
    process.exit(1);
  });
}

export { createMainProgram };
