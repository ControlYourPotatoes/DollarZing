// Simple Test Command - Basic CLI functionality test
// Minimal command to verify CLI structure works

import { Command } from 'commander';

export function createSimpleTestCommand(): Command {
  const command = new Command('simple-test');
  
  command
    .description('Simple test to verify CLI is working')
    .option('-n, --name <name>', 'Name to greet', 'World')
    .action((options) => {
      console.log('🎯 DollarZing Engine CLI Test');
      console.log('============================');
      console.log(`Hello, ${options.name}!`);
      console.log('');
      console.log('✅ CLI structure is working correctly');
      console.log('📁 Project structure:');
      console.log('  • engine/src/ - Simulation engine library');
      console.log('  • engine/cli/ - CLI tools and commands');
      console.log('  • engine/bin/ - Executable entry points');
      console.log('');
      console.log('🚀 Ready to build dataset generation tools!');
    });

  return command;
}