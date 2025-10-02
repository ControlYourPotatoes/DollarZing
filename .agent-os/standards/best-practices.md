# Development Best Practices

> Version: 1.0.0
> Last updated: 2025-03-02
> Scope: Global development standards

## Context

This file is part of the Agent OS standards system. These global best practices are referenced by all product codebases and provide default development guidelines. Individual projects may extend or override these practices in their `.agent-os/product/dev-best-practices.md` file.

## Core Principles

### Keep It Simple
- Implement code in the fewest lines possible
- Avoid over-engineering solutions
- Choose straightforward approaches over clever ones

### Optimize for Readability
- Prioritize code clarity over micro-optimizations
- Write self-documenting code with clear variable names
- Add comments for "why" not "what"

### DRY (Don't Repeat Yourself)
- Extract repeated business logic to private methods
- Extract repeated UI markup to reusable components
- Create utility functions for common operations

### Fast Feedback
- Design code for rapid validation with clear inputs/outputs
- Create deterministic logic that produces predictable results
- Build isolated components that can be verified independently
- Include early validation points (type checking, linting, quick smoke tests)
- Always ask: "How can we quickly know if this works?"

### Test-First Mindset
- Write tests before implementation when building new features
- Let tests guide your design toward better interfaces
- Use tests as executable specifications of behavior
- If it's hard to test, the design needs improvement

### Measure, Don't Guess
- Base technical decisions on evidence and measurable outcomes
- Use profiling tools to identify actual performance bottlenecks
- Track meaningful metrics from the start
- Question assumptions and validate with data

## Architecture & Design

### Ports & Adapters
- Abstract all external services behind interfaces (databases, APIs, file systems)
- Keep business logic pure and testable by separating infrastructure concerns
- Use adapter pattern for third-party services and external dependencies

### Dependency Injection
- Use constructor injection for all dependencies to enable testing and modularity
- Inject interfaces, not concrete implementations
- Make dependencies explicit and controllable

### Separation of Concerns
- Keep business logic separate from infrastructure code
- Layer your application: UI → Business Logic → Data Access
- Avoid mixing concerns within a single class or function

### Single Responsibility
- Each class/function should have one reason to change
- Focus each component on a single, well-defined responsibility
- Split components that are doing multiple things

### Loose Coupling
- Minimize dependencies between components
- Prefer asynchronous communication for distributed operations
- Use events/messaging for decoupled communication

## Testing Practices

### Mocking Strategy
- Use mocks to isolate units of behavior, not as shortcuts when things go wrong
- Mock external dependencies to test business logic in isolation
- Prefer real implementations unless specifically testing isolated behavior
- Don't mock what you don't own - wrap third-party services in your own interfaces

### Implementation Strategy
- Break feature implementation into logical, testable chunks
- Each commit should be potentially deployable (use feature flags for incomplete features)
- Build in validation checkpoints to verify your approach is working

## Dependencies

### Choose Libraries Wisely
When adding third-party dependencies:
- Select the most popular and actively maintained option
- Check the library's GitHub repository for:
  - Recent commits (within last 6 months)
  - Active issue resolution
  - Number of stars/downloads
  - Clear documentation

## Code Organization

### File Structure
- Keep files focused on a single responsibility
- Group related functionality together
- Use consistent naming conventions

### Testing
- Write tests for new functionality
- Maintain existing test coverage
- Test edge cases and error conditions

---

*Customize this file with your team's specific practices. These guidelines apply to all code written by humans and AI agents.*