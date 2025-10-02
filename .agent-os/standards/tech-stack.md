# Tech Stack

> Version: 1.0.0
> Last Updated: 2025-08-31

## Context

This file is part of the Agent OS standards system. These global tech stack defaults are referenced by all product codebases when initializing new projects. Individual projects may override these choices in their `.agent-os/product/tech-stack.md` file.

## Primary Stack

### Application Framework
- **Framework:** Next.js
- **Version:** Latest stable
- **Language:** TypeScript
- **Node Version:** 22 LTS

### API Layer
- **Type Safety:** tRPC
- **Version:** Latest stable
- **Benefits:** End-to-end type safety for easier debugging

### Database
- **Primary:** PostgreSQL
- **Version:** 17+
- **Hosting:** Supabase (managed PostgreSQL)
- **Alternative:** Self-hosted PostgreSQL

## Frontend Stack

### JavaScript Framework
- **Framework:** Next.js with React
- **Version:** Latest stable
- **Build Tool:** Built-in Next.js tooling

### Import Strategy
- **Strategy:** Node.js modules
- **Package Manager:** npm or yarn
- **Node Version:** 22 LTS

### CSS Framework
- **Framework:** TailwindCSS
- **Version:** 4.0+
- **PostCSS:** Yes

### UI Components
- **Library:** shadcn/ui
- **Version:** Latest
- **Installation:** Via CLI tool

### State Management
- **Primary:** Zustand
- **Server State:** React Query
- **Benefits:** Simple, performant state management

## Alternative Backend Languages

### Go
- **Use Case:** Performance-critical services, microservices
- **Version:** Latest stable
- **Strengths:** High performance, excellent for APIs and data processing

### Python/Flask
- **Use Case:** Data processing, ETL pipelines, analytics
- **Version:** Python 3.11+
- **Framework:** Flask
- **Strengths:** Data science ecosystem, rapid prototyping

## Assets & Media

### Fonts
- **Provider:** Google Fonts
- **Loading Strategy:** Self-hosted for performance

### Icons
- **Library:** Lucide
- **Implementation:** React components

## Infrastructure

### Application Hosting
- **Platform:** Vercel (for Next.js)
- **Alternative:** Digital Ocean App Platform
- **Benefits:** Seamless Next.js deployment and scaling

### Database Hosting
- **Primary:** Supabase
- **Service:** Managed PostgreSQL with real-time features
- **Backups:** Automated daily backups
- **Alternative:** Digital Ocean Managed PostgreSQL

### Asset Storage
- **Provider:** Amazon S3
- **CDN:** CloudFront
- **Access:** Private with signed URLs

### Containerization
- **Platform:** Docker
- **Use Case:** Development environments and alternative deployments

## Deployment

### CI/CD Pipeline
- **Platform:** GitHub Actions
- **Trigger:** Push to main/staging branches
- **Tests:** Run before deployment

### Environments
- **Production:** main branch
- **Staging:** staging branch
- **Preview:** PR-based (Vercel preview deployments)

### Database Migrations
- **Strategy:** Version-controlled migrations
- **Tool:** Built-in framework migration tools (Prisma, Drizzle, or native)

---

*Customize this file with your organization's preferred tech stack. These defaults are used when initializing new projects with Agent OS.*