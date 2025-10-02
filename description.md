Based on the codebase context, you're asking about DollarZing, a financial simulation and presentation platform that visualizes gaming platform economics through interactive data visualizations . Here's the project context for resume/cover letter purposes:

Project Overview
DollarZing is a sophisticated data visualization platform that simulates and presents financial flows for a gaming/gambling platform with charitable giving components PrototypeDashboard.tsx:222-230 . The system demonstrates how revenue flows through platform fees, charity donations, and player payouts using interactive timeline scrubbing and custom SVG-based financial workflow diagrams STRUCTURE.md:15-21 .

Technical Architecture
The project features a curated dataset system that generates 27 anchor datasets representing different parameter combinations (growth rates, risk levels, charity percentages) with intelligent interpolation between scenarios spec.md:9 .

Key technical components include:

Custom SVG Timeline Scrubber: Interactive timeline navigation through up to 365 days of simulation data with smooth animations and keyboard shortcuts tasks.md:22-25

Financial Workflow Diagrams: Custom SVG-based node-link visualizations showing money flow between financial entities with layered progress indicators and hover interactions

Presentation Data Pipeline: TypeScript-based system for loading, normalizing, and interpolating between pregenerated simulation snapshots STRUCTURE.md:33-35

Business Context
The platform targets investment analysts, business executives, and regulatory compliance officers who need to present reliable financial projections and demonstrate platform economics spec.md:14-16 . The system incorporates realistic player spending research and retention metrics from mobile gaming and social casino industries Player-Spending-Research.md:1-5 .

Technical Stack
Frontend: React with TypeScript, Tailwind CSS, Framer Motion for animations
Data Visualization: Custom SVG components with D3.js utilities for complex path generation
State Management: Zustand store for timeline and presentation state
Testing: Vitest framework with comprehensive test coverage
Deployment: GitHub Pages compatible static build
This project demonstrates expertise in data visualization, financial modeling, interactive UI development, and presentation-ready software architecture.

Notes
The project shows a sophisticated understanding of both technical implementation (custom SVG rendering, animation systems, data interpolation) and business requirements (regulatory compliance, stakeholder presentations, investment analysis). The modular architecture with feature-based organization demonstrates scalable frontend development practices.

back end

Engine Architecture Overview
The DollarZing simulation engine demonstrates excellent architectural patterns through its event-driven design and component modularity index.ts:1-62 . The engine is built around the GameEngineSimulator as the central orchestrator, coordinating all simulation execution through pure event-driven architecture tasks.md:90-103 .

Event-Driven Architecture
The engine implements a sophisticated event-driven architecture where components communicate exclusively through an EventBus system, enabling loose coupling and comprehensive testing tasks.md:64-76 . This design includes priority-based event handlers that process business logic in a coordinated sequence:

GameEventHandler (Priority: 10) - Handles game creation and resolution
PlayerProgressionHandler (Priority: 12) - Manages player advancement through betting levels
RevenueTrackingHandler (Priority: 15) - Tracks financial transactions
MatchmakingEventHandler (Priority: 20) - Coordinates game matching
Component Orchestration
The DayProcessor serves as the temporal orchestrator, coordinating daily simulation cycles through pure event emission rather than direct component manipulation day-processor.ts:24-39 . This creates a clean separation where the day processor emits events like DAY_STARTED and NEW_RUN_CREATED, and other components respond accordingly.

Factory Pattern and Object Management
The engine employs sophisticated factory patterns with object pooling for performance optimization tasks.md:122-132 . The system includes:

Production factories with object pooling for high-performance scenarios
Development factories with direct object creation for debugging
Configurable performance settings that can be switched at runtime
Modular Component Design
The engine demonstrates excellent separation of concerns through its modular component structure tasks.md:145-172 :

VirtualDollarManager - Handles dollar lifecycle and state management
GameMatchingEngine - Manages 1v1 game matching and execution
PlayerManager - Implements S-curve growth modeling and player lifecycle
RevenueCalculator - Tracks platform fees, charity contributions, and payouts
ScoringEngine - Provides deterministic scoring with daily seeded algorithms
Integration and Testing Architecture
The engine includes comprehensive integration testing patterns that validate complete event flows with minimal mocking, ensuring authentic system behavior through real component assembly tasks.md:105-121 . This demonstrates production-ready architecture with proper component integration and audit trail completeness for regulatory compliance.

Dataset Generation Pipeline
The engine integrates seamlessly with a dataset orchestration system that can generate 27 parameter combinations (3×3×3 matrix) for comprehensive scenario analysis spec.md:31-37 . This shows how the engine architecture scales from individual simulations to batch dataset generation.

Notes
The engine architecture showcases advanced software engineering practices including dependency injection, event-driven patterns, factory methods, object pooling, and comprehensive testing strategies. The clean separation between simulation logic and presentation layer demonstrates scalable architecture suitable for both development and production environments.
