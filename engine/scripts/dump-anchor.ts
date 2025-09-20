import { createProductionSimulator } from '../src/simulation/simulator-factories';

const { simulator, profile } = createProductionSimulator({
  profileOverrides: {
    name: 'anchor-001',
    config: {
      durationDays: 7,
      initialPlayerCount: 80,
      dailySeed: 'anchor-001',
      maxSimulationTimeMs: 180000,
      enableProgressReporting: false,
    },
  },
});

const results = await simulator.executeSimulation(profile.config);
console.log(JSON.stringify(results, null, 2));
