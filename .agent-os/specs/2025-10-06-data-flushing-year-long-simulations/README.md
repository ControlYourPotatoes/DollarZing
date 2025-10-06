# Data Flushing for Year-Long Simulations

## Purpose

This specification defines the implementation of periodic data flushing to disk during long-running DollarZing simulations. The goal is to prevent memory bloat during 365-day runs while maintaining data integrity and enabling recovery from mid-simulation failures.

## Problem Statement

Current simulations hold all data in memory until completion:

- 30-day runs: ~40MB baseline + data accumulation
- 365-day runs: theoretically ~480MB, actually 2-4GB due to data structures
- Container limit: 15GB, with 14GB heap allocation
- Risk: OOM kills during long runs, lost computation time

## Solution Overview

Implement checkpointing system that:

- Writes complete dataset snapshots every 30 days
- Triggers emergency checkpoints when memory exceeds 10GB
- Maintains lightweight continuation state
- Merges checkpoints into final dataset
- Enables resume from interrupted runs

## Files in This Spec

- [`spec.md`](spec.md) - Complete requirements and architecture
- [`tasks.md`](tasks.md) - Implementation breakdown by phase
- [`data-contract.md`](data-contract.md) - Checkpoint file format specification

## Quick Start

### Enable Checkpointing

```bash
NODE_OPTIONS="--max-old-space-size=14336" node dist/scripts/run-orchestrator.js \
  --days 365 \
  --combo 35,high,10 \
  --checkpoint-interval 30 \
  --checkpoint-memory-threshold 10240
```

### Expected Output

```
generated-datasets/
├── checkpoints/
│   ├── checkpoint-day-030-2025-10-06T12-00-00.json
│   ├── checkpoint-day-060-2025-10-06T18-30-15.json
│   └── ...
└── anchor-datasets/
    └── growth-35_risk-high_charity-10/
        └── dataset.json (final merged)
```

## Success Criteria

- ✅ 365-day simulation completes with <4GB peak memory
- ✅ Checkpoint overhead <5% of total runtime
- ✅ Data integrity maintained across checkpoints
- ✅ Resume functionality works for interrupted runs

## Implementation Status

- **Phase 1 (Core)**: Not started
- **Phase 2 (Memory)**: Not started
- **Phase 3 (State)**: Not started
- **Phase 4 (Resume)**: Not started

## Risk Assessment

### High Risk

- Memory monitoring accuracy on different platforms
- Checkpoint write performance impact
- Data consistency during merge operations

### Medium Risk

- File system I/O bottlenecks
- Checkpoint file size growth
- Resume state restoration complexity

### Low Risk

- Configuration parameter validation
- Error handling for edge cases
- Documentation completeness

## Next Steps

1. **Immediate**: Review and approve spec
2. **Week 1**: Implement Phase 1 (Core Checkpointing)
3. **Week 2**: Implement Phase 2 (Memory Monitoring)
4. **Month 1**: Full system testing and optimization
5. **Month 2**: Resume functionality and production deployment

## Contact

For questions about this specification, refer to the implementation tasks or create an issue in the project repository.</content>
</xai:function_call">Create a README summarizing the data flushing spec.
