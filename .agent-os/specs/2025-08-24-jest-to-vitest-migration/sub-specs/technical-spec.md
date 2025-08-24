# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-24-jest-to-vitest-migration/spec.md

> Created: 2025-08-24
> Version: 1.0.0

## Technical Requirements

- Remove Jest dependencies: jest, @types/jest, ts-jest
- Install Vitest dependencies: vitest, @vitest/ui (optional UI mode)
- Update vite.config.ts to include Vitest test configuration
- Ensure all existing test files work with Vitest APIs (describe, test, expect)
- Maintain existing test directory structure and file patterns
- Preserve current test coverage collection paths and patterns
- Update package.json scripts to use vitest commands
- Remove Jest-specific configuration from package.json

## Approach Options

**Option A:** Minimal Migration (Selected)
- Pros: Fastest migration path, minimal changes to test files, preserves existing test structure
- Cons: May not take full advantage of Vitest-specific features

**Option B:** Full Vitest Feature Adoption
- Pros: Maximum performance benefits, modern testing features, better IDE integration
- Cons: More extensive code changes, potential for introducing bugs during migration

**Option C:** Gradual Migration
- Pros: Lower risk of breaking tests, ability to validate incrementally
- Cons: Temporary complexity of running two test systems, longer migration timeline

**Rationale:** Option A is selected because the primary goal is to resolve configuration issues quickly while maintaining the existing working test suite. The project has extensive tests that are currently functional in terms of logic, so the migration should focus on fixing the infrastructure problems rather than rewriting tests.

## External Dependencies

- **vitest** - Modern, fast unit testing framework built on Vite
- **Justification:** Native Vite integration eliminates ESM/TypeScript configuration issues that Jest has with this project's setup

- **@vitest/ui** (optional) - Browser-based UI for test visualization
- **Justification:** Provides better developer experience for debugging tests, especially useful for complex engine test suites

## Configuration Details

### Vite Config Integration
The Vitest configuration will be added to the existing vite.config.ts file using the `test` property:

```typescript
/// <reference types="vitest" />
export default defineConfig({
  // existing config...
  test: {
    environment: 'node',
    globals: true, // enables describe, test, expect globally
    include: ['**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist', '.git'],
  }
})
```

### TypeScript Configuration
No changes needed to tsconfig.json since Vitest uses the existing Vite TypeScript configuration.

### Package.json Script Updates
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:run": "vitest run"
  }
}
```

## Migration Strategy

1. **Dependency Swap**: Remove Jest packages and install Vitest
2. **Configuration Update**: Add Vitest config to vite.config.ts and remove Jest config from package.json
3. **Script Updates**: Update package.json test scripts
4. **Validation**: Run all tests to ensure they pass with Vitest
5. **Cleanup**: Remove any Jest-specific files or configurations