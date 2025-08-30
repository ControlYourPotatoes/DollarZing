import { Command } from 'commander';
import type { OrchestratorConfig } from './types';
export declare function createCliProgram(): Command;
export declare function parseCliArguments(argv: string[]): OrchestratorConfig;
export declare function validateCliConfiguration(config: OrchestratorConfig): void;
export declare function parseCliArgumentsWithErrorHandling(argv: string[]): OrchestratorConfig;
export declare function showHelp(): void;
export declare function displayConfiguration(config: OrchestratorConfig): void;
export declare function validateSystemRequirements(): void;
export declare function createCliDefaultConfig(): OrchestratorConfig;
//# sourceMappingURL=cli.d.ts.map