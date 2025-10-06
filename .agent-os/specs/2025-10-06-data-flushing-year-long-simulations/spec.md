# Spec Requirements Document

> Spec: Data Flushing for Year-Long Simulations
> Created: 2025-10-06
> Status: Planning

## Overview

Implement periodic data flushing to disk during long-running simulations to prevent memory bloat and enable recovery from mid-simulation failures. The system must maintain data integrity while reducing peak memory usage by 60-80% for 365-day simulations, allowing runs that would otherwise exceed container memory limits.

## Assumptions

- Current simulation holds all data in memory until completion
- 30-day runs consume ~40MB RSS baseline + object pooling overhead
- 365-day runs would theoretically require ~480MB but actually need 2-4GB due to data accumulation
- Container has 15GB memory limit with 14GB heap allocation available
- Dataset structure supports incremental writing and merging
- File system performance allows checkpoint writes without significant simulation slowdown

## User Stories

### Memory-Constrained Long Runs

As a simulation engineer running year-long scenarios on resource-limited infrastructure, I want automatic checkpointing every 30 days so I can execute 365-day simulations without hitting memory limits or losing progress if the process crashes.

**Flow:** Engineer starts simulation with `--checkpoint-interval 30`, system writes complete dataset snapshots to disk every 30 days, continues with lightweight state, and produces final merged dataset on completion.

### Memory Threshold Protection

As a simulation operator monitoring long-running jobs, I want emergency checkpointing when memory usage exceeds 10GB so the system automatically protects itself from OOM kills during unexpected memory spikes.

**Flow:** System monitors memory usage during simulation, triggers immediate checkpoint when threshold exceeded, logs the event, and continues with reduced memory footprint.

### Recovery from Interruptions

As a researcher whose simulation was interrupted after 200 days, I want to resume from the last checkpoint so I don't lose weeks of computation time.

**Flow:** Researcher identifies last successful checkpoint file, modifies run command to `--resume-from day-180.json`, system loads checkpoint data and continues simulation from day 181.

## Spec Scope

In scope: checkpoint interval configuration, memory threshold monitoring, dataset serialization/deserialization, checkpoint file management, final dataset merging, resume functionality foundation.

Out of scope: distributed checkpoint storage, cloud backup integration, parallel simulation resumption, checkpoint compression, memory profiling dashboard.

## Architecture Outline

### Checkpoint System Components

- **Checkpoint Manager**: Core service handling serialization timing, file I/O, and state management
- **Memory Monitor**: Background process tracking heap/RSS usage against configurable thresholds
- **Dataset Serializer**: Efficient JSON streaming writer for large dataset objects
- **State Reducer**: Lightweight state extraction for continuation (active pool, player states, revenue counters)
- **Merge Utility**: Post-run combiner for checkpoint files + final state

### Configuration Options

```typescript
interface CheckpointConfig {
  enabled: boolean;
  intervalDays: number; // Default: 30
  memoryThresholdMB: number; // Default: 10240 (10GB)
  checkpointDir: string; // Default: "generated-datasets/checkpoints"
  compressionEnabled: boolean; // Default: false
}
```

### File Structure

```
generated-datasets/
├── checkpoints/
│   ├── day-30.json
│   ├── day-60.json
│   ├── day-90.json
│   └── ...
├── anchor-datasets/
│   └── growth-35_risk-high_charity-10/
│       └── dataset.json (final merged)
└── temp/
    └── active-simulation-state.json (lightweight continuation state)
```

### Checkpoint Data Format

```json
{
  "checkpoint": {
    "day": 30,
    "timestamp": "2025-10-06T12:00:00Z",
    "memoryUsage": {
      "rss": 2147483648,
      "heapUsed": 1073741824,
      "heapTotal": 2147483648
    }
  },
  "simulation": {
    "config": { /* full simulation config */ },
    "summary": {
      "totalDays": 30,
      "totalPlayers": 1234,
      "simulationCompleted": false
    },
    "playerStats": { /* complete player statistics */ },
    "revenueStats": { /* complete revenue data */ },
    "gameStats": { /* complete game statistics */ },
    "dailyResults": [ /* array of daily snapshots */ ]
  }
}
```

## Implementation Plan

### Phase 1: Core Checkpointing
1. Add CheckpointManager class to run-orchestrator.ts
2. Implement interval-based checkpointing
3. Add dataset serialization utilities
4. Test with 30-day runs

### Phase 2: Memory Monitoring
1. Add memory usage monitoring
2. Implement threshold-based emergency checkpoints
3. Add logging for checkpoint events
4. Test memory threshold triggering

### Phase 3: State Management
1. Implement lightweight continuation state
2. Add checkpoint file validation
3. Create merge utility for final dataset
4. Test end-to-end checkpoint/merge cycle

### Phase 4: Resume Functionality (Foundation)
1. Add --resume-from parameter parsing
2. Implement checkpoint loading logic
3. Add state restoration from checkpoint
4. Document resume workflow

## Success Criteria

- [ ] 365-day simulation completes with <4GB peak memory usage
- [ ] Checkpoint files are valid JSON and contain complete data
- [ ] Final merged dataset matches non-checkpointed equivalent
- [ ] Memory threshold triggering works reliably
- [ ] Checkpoint overhead <5% of total simulation time
- [ ] System recovers gracefully from interrupted checkpoints

## Risk Mitigation

### Memory Leaks
- Monitor checkpoint file sizes for unexpected growth
- Implement checkpoint cleanup for failed runs
- Add memory profiling hooks for debugging

### Data Corruption
- Validate JSON structure before writing checkpoints
- Implement checksums for critical data sections
- Maintain backup of last 2 checkpoints

### Performance Impact
- Benchmark checkpoint write times on target hardware
- Implement async checkpoint writing to avoid blocking
- Add configuration to disable checkpoints for short runs

## Testing Strategy

### Unit Tests
- CheckpointManager serialization/deserialization
- Memory threshold detection
- File I/O error handling

### Integration Tests
- 30-day run with 10-day checkpoints
- Memory threshold triggering simulation
- Checkpoint merge validation

### Performance Tests
- Checkpoint write time vs simulation time ratio
- Memory usage comparison: checkpointed vs non-checkpointed
- File system I/O impact on simulation speed

## Migration Path

1. **Immediate**: Add checkpointing behind feature flag
2. **Week 1**: Enable for all long runs (>100 days)
3. **Week 2**: Add memory monitoring and emergency checkpoints
4. **Month 1**: Implement resume functionality
5. **Month 2**: Optimize checkpoint format and compression

## Dependencies

- Node.js fs/promises for async file operations
- Existing dataset serialization logic
- Memory monitoring APIs (process.memoryUsage)
- Configuration system for checkpoint settings</content>
</xai:function_call">Create the spec document for data flushing feature.