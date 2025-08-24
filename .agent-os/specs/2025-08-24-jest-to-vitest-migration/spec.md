# Spec Requirements Document

> Spec: Jest to Vitest Migration
> Created: 2025-08-24
> Status: Planning

## Overview

Migrate the DollarZing project from Jest to Vitest to resolve ESM/TypeScript configuration conflicts and improve test performance and developer experience. This migration will eliminate current Jest setup issues and provide seamless integration with the existing Vite build system.

## User Stories

### Developer Testing Experience Improvement

As a developer working on the DollarZing engine, I want to run tests without configuration warnings or ESM conflicts, so that I can focus on writing and maintaining quality code instead of fighting with testing infrastructure.

The current Jest setup produces configuration warnings, has TypeScript global definition issues, and conflicts with the project's `"type": "module"` ESM setup. Developers waste time troubleshooting test configuration instead of writing business logic tests.

### Build Pipeline Consistency

As a developer, I want the testing framework to use the same configuration and transformations as the build system, so that there are no discrepancies between test and production environments.

Currently Jest requires separate TypeScript configuration (ts-jest) and ESM handling, while Vite already handles these concerns for the build pipeline. This creates configuration drift and maintenance overhead.

### Performance and Developer Experience

As a developer running frequent tests during development, I want fast test execution and reliable watch mode, so that I can maintain a productive TDD workflow.

Jest with ts-jest has slower TypeScript compilation and watch mode performance compared to Vitest's native Vite integration, especially for the complex engine test suite.

## Spec Scope

1. **Jest Dependencies Removal** - Remove all Jest-related packages and configuration from package.json and project files
2. **Vitest Installation and Configuration** - Install Vitest and configure it to work with existing TypeScript/ESM setup
3. **Test File Migration** - Update all existing test files to work with Vitest APIs and configuration
4. **Package Script Updates** - Replace Jest scripts with equivalent Vitest commands
5. **Configuration Integration** - Integrate Vitest configuration into existing vite.config.ts
6. **Complete Task 8 Integration Tests** - Implement all pending integration and end-to-end tests from the Virtual Dollar Pool Engine spec under the new Vitest framework

## Out of Scope

- Rewriting test logic or test coverage (maintain existing test behavior)
- Adding new test features or capabilities beyond what Jest provided
- Changes to test file organization or structure
- Performance optimization beyond what Vitest provides by default

## Expected Deliverable

1. All existing tests pass with Vitest instead of Jest
2. No configuration warnings or TypeScript global definition issues
3. Test scripts (test, test:watch) work seamlessly with new setup
4. Faster test execution compared to current Jest implementation
5. Complete Task 8 integration tests implemented and passing under Vitest framework
6. All Virtual Dollar Pool Engine integration and end-to-end tests validated with independent run system

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-24-jest-to-vitest-migration/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-24-jest-to-vitest-migration/sub-specs/technical-spec.md
- Tests Specification: @.agent-os/specs/2025-08-24-jest-to-vitest-migration/sub-specs/tests.md