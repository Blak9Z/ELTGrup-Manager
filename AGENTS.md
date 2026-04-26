<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project AI Agents

This project uses specialized AI agents from `lodetomasi/agents-claude-code` installed in `.agents/`.

## Active Agents

- `nextjs-architect` (model: sonnet) — Next.js App Router, SSR/SSG, middleware patterns, edge runtime
- `react-wizard` (model: sonnet) — React 19, hooks, concurrent features, state management
- `typescript-sage` (model: sonnet) — Advanced generics, strict types, migration strategies
- `tailwind-artist` (model: haiku) — Utility-first CSS, responsive layout, design tokens
- `performance-optimizer` (model: opus) — Profiling, bundle analysis, Core Web Vitals, caching
- `database-wizard` (model: sonnet) — Schema design, query optimization, migration strategies
- `postgresql-guru` (model: sonnet) — PostgreSQL advanced features, indexing, partitioning
- `vitest-virtuoso` (model: haiku) — Fast testing, coverage, CI setup
- `accessibility-guardian` (model: sonnet) — WCAG compliance, ARIA, keyboard navigation
- `playwright-pro` (model: haiku) — E2E testing, visual comparisons
- `seo-specialist` (model: sonnet) — Metadata, structured data, performance SEO
- `threat-modeler` (model: sonnet) — Security audits, threat analysis

## How They Work

When interacting with this project, these agents provide context-aware expertise. Load an agent by referencing its name in your prompt, or let Claude detect the right specialist based on the task.

Key conventions:
1. Profile first, optimize what matters (performance-agent)
2. Types are documentation that never goes out of date (typescript-sage)
3. Accessibility benefits everyone (accessibility-guardian)
4. Premature optimization is still evil — measure before changing (react-wizard)

## Applied Improvements (2026-04-26)

- `next.config.ts`: `optimizePackageImports` for heavy packages, `removeConsole` in prod, `minimumCacheTTL` for images, `Strict-Transport-Security` header
- `src/lib/prisma.ts`: Added `findFirstOrThrow` to global extensions, conditional query logging in production
- `vitest.config.ts`: HTML coverage reporter, CPU-aware concurrency, baseline thresholds
- `app/layout.tsx`: `themeColor`, `suppressHydrationWarning`, semantic lang="ro"
- `proxy.ts`: Uses proxy middleware pattern instead of `middleware.ts` (Next.js 16 convention)
- `playwright.config.ts`: E2E testing with cross-browser support, mobile emulation, auth state persistence
- `e2e/`: Suite complet — login, dashboard, RBAC, responsive, security headers
- `package.json`: Scripts `test:e2e`, `test:e2e:ui`, `test:e2e:report`

