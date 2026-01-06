<!--
LOG DECISIONS WHEN:
- Choosing between architectural approaches
- Selecting libraries or tools
- Making security-related choices
- Deviating from standard patterns

This is append-only. Never delete entries.
-->

# Decision Log

Track key architectural and implementation decisions.

## Format
```
## [YYYY-MM-DD] Decision Title

**Decision**: What was decided
**Context**: Why this decision was needed
**Options Considered**: What alternatives existed
**Choice**: Which option was chosen
**Reasoning**: Why this choice was made
**Trade-offs**: What we gave up
**References**: Related code/docs
```

---

## [2026-01-06] Initial Tech Stack

**Decision**: Use Next.js 16 with TypeScript, React 19, Tailwind CSS 4
**Context**: Project initialization - needed to choose frontend framework
**Options Considered**: Next.js (App Router), Vite + React, Remix
**Choice**: Next.js 16 with App Router
**Reasoning**: Already initialized with create-next-app, good defaults for SSR/SSG, easy deployment
**Trade-offs**: More opinionated than Vite, larger bundle
**References**: package.json

## [2026-01-06] No Database Initially

**Decision**: Start without a database, plan for SQLite later
**Context**: Simple scheduling app, local-first approach
**Options Considered**: Supabase, SQLite, None
**Choice**: None initially, SQLite planned
**Reasoning**: Keep it simple for MVP, add persistence when needed
**Trade-offs**: Data won't persist between sessions initially
**References**: CLAUDE.md
