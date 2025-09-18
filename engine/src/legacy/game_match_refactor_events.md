Here's a proposal for the next Claude agent to continue the factory cleanup work:

  # Factory Cleanup Continuation

  ## Context
  We've been refactoring the DollarZing simulation from real-time to event-driven architecture. The VirtualDollar factory has been successfully unified from separate
   Factory/Manager classes into a single `UnifiedVirtualDollarFactory`. The deprecated `DirectVirtualDollarFactory` class still exists but should be removed.

  ## Current State
  - ✅ `UnifiedVirtualDollarFactory` is implemented and working correctly
  - ✅ Production code uses `UnifiedVirtualDollarFactory` (exported in `/workspace/engine/src/index.ts`)
  - ⚠️ `DirectVirtualDollarFactory` still exists in `/workspace/engine/src/types/direct-factories.ts` (lines 68-375 approximately)
  - ⚠️ Legacy tests still reference `DirectVirtualDollarFactory`

  ## Tasks to Complete

  ### 1. Remove Deprecated DirectVirtualDollarFactory
  - Remove the entire `DirectVirtualDollarFactory` class from `/workspace/engine/src/types/direct-factories.ts`
  - Keep the `DirectGameSessionFactory` class (it's still needed)
  - Add a comment indicating the removal: `// DirectVirtualDollarFactory has been deprecated and removed - use UnifiedVirtualDollarFactory`

  ### 2. Update Tests
  Update these test files to use `UnifiedVirtualDollarFactory`:
  - `/workspace/engine/tests/direct-virtual-dollar-factory.test.ts`
  - `/workspace/engine/tests/factory-interface-compliance.test.ts`

  ### 3. Update Product Decisions
  Add a new decision to `/workspace/.agent-os/product/decisions.md`:

  ```markdown
  ## 2025-09-12: VirtualDollar Factory Unification Cleanup

  **ID:** DEC-005
  **Status:** Accepted
  **Category:** Technical
  **Stakeholders:** Development Team

  ### Decision
  Remove the deprecated `DirectVirtualDollarFactory` class and migrate all remaining usage to `UnifiedVirtualDollarFactory` to complete the factory pattern
  unification.

  ### Context
  The factory pattern refactor successfully unified VirtualDollar creation and state management into `UnifiedVirtualDollarFactory`. The legacy
  `DirectVirtualDollarFactory` remained for test compatibility but is no longer needed, creating potential confusion about which factory to use.

  ### Consequences
  **Positive:**
  - Single source of truth for VirtualDollar operations
  - Cleaner codebase with no deprecated code paths
  - Forces discovery of any hidden dependencies on deprecated factory

  **Negative:**
  - Breaking change for any tests expecting the old factory
  - Need to update existing test suites

  4. Verify No Broken References

  Run tests to ensure no hidden dependencies on DirectVirtualDollarFactory exist:
  npm test

  5. Current Event-Driven Test Issues (Secondary Priority)

  There are failing integration tests in /workspace/engine/src/events/event-system-integration.test.ts due to:
  - ID mismatches between test setup and events (using hardcoded IDs vs factory-generated IDs)
  - Error handling expectations not matching factory behavior

  Files to Examine

  - /workspace/engine/src/types/direct-factories.ts - Remove deprecated class
  - /workspace/engine/tests/direct-virtual-dollar-factory.test.ts - Update tests
  - /workspace/engine/tests/factory-interface-compliance.test.ts - Update tests
  - /workspace/.agent-os/product/decisions.md - Document decision
  - /workspace/engine/src/events/event-system-integration.test.ts - Fix if time permits

  Success Criteria

  - DirectVirtualDollarFactory class removed
  - All tests pass with UnifiedVirtualDollarFactory
  - Product decision documented
  - No compilation errors or broken imports

  This should give the next agent a clear understanding of where you left off and what needs to be completed.

  Todos
  ☐ Remove deprecated DirectVirtualDollarFactory class
  ☐ Update tests to use UnifiedVirtualDollarFactory
  ☐ Document factory cleanup decision in product decisions
  ☐ Verify no broken references remain