# CLAUDE.md

## Skills
Read and follow these skills before writing any code:
- .claude/skills/base.md
- .claude/skills/security.md
- .claude/skills/project-tooling.md
- .claude/skills/session-management.md
- .claude/skills/typescript.md
- .claude/skills/react-web.md
- .claude/skills/timezone-architecture.md (CRITICAL: read before ANY timezone-related work)

## Project Overview
A tabletop gaming session scheduler for coordinating game nights. Helps groups organize and schedule their tabletop RPG sessions.

## Tech Stack
- Language: TypeScript
- Framework: Next.js 16 (React 19)
- Styling: Tailwind CSS 4
- Database: Vercel Postgres
- AI: Anthropic Claude (for availability parsing)
- Deployment: Vercel (push to deploy)

## Key Commands
```bash
# Verify all CLI tools are working
./scripts/verify-tooling.sh

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Documentation
- `docs/` - Technical documentation
- `_project_specs/` - Project specifications and todos

## Atomic Todos
All work is tracked in `_project_specs/todos/`:
- `active.md` - Current work
- `backlog.md` - Future work
- `completed.md` - Done (for reference)

Every todo must have validation criteria and test cases. See base.md skill for format.

## Session Management

### State Tracking
Maintain session state in `_project_specs/session/`:
- `current-state.md` - Live session state (update every 15-20 tool calls)
- `decisions.md` - Key architectural/implementation decisions (append-only)
- `code-landmarks.md` - Important code locations for quick reference
- `archive/` - Past session summaries

### Automatic Updates
Update `current-state.md`:
- After completing any todo item
- Every 15-20 tool calls during active work
- Before any significant context shift
- When encountering blockers

### Decision Logging
Log to `decisions.md` when:
- Choosing between architectural approaches
- Selecting libraries or tools
- Making security-related choices
- Deviating from standard patterns

### Context Compression
When context feels heavy (~50+ tool calls):
1. Summarize completed work in current-state.md
2. Archive verbose exploration notes to archive/
3. Keep only essential context for next steps

### Session Handoff
When ending a session or approaching context limits, update current-state.md with:
- What was completed this session
- Current state of work
- Immediate next steps (numbered, specific)
- Open questions or blockers
- Files to review first when resuming

### Resuming Work
When starting a new session:
1. Read `_project_specs/session/current-state.md`
2. Check `_project_specs/todos/active.md`
3. Review recent entries in `decisions.md` if context needed
4. Continue from "Next Steps" in current-state.md

## Project-Specific Patterns
- Next.js App Router for routing
- Server Components by default, Client Components when needed
- Tailwind CSS for styling
- 30-minute time slot granularity for availability
- Mobile: AI text input only (no drag grid)
- Desktop: Both drag-select grid and AI text input

## Timezone Architecture (CRITICAL)
**Read `.claude/skills/timezone-architecture.md` before ANY timezone work.**

Key rules:
- **Database**: Availability in UTC, patterns in user's local timezone, event times in event's timezone
- **Display**: Convert to user's selected timezone (default: browser local)
- **Timezone switcher**: Available on all pages with time displays
- **Calendar grids**: Accept `timeWindowTimezone` prop to specify SOURCE timezone of time window
  - GM page: Pass local times ("00:00"-"23:30"), no `timeWindowTimezone` (already local)
  - Campaign/Heatmap: Pass `timeWindowTimezone={event.timezone}` to convert event times
  - Player page: Convert bounds to local BEFORE passing, no `timeWindowTimezone`
- **GM availability window**: Clamps player views but not GM view (GM sees 24 hours)

## Key Files
- `lib/db/schema.sql` - Database schema (run in Vercel Dashboard)
- `lib/types/index.ts` - All TypeScript interfaces
- `lib/utils/overlap.ts` - Overlap calculation algorithm
- `lib/ai/availability-parser.ts` - Claude API integration
- `components/availability/AvailabilityGrid.tsx` - Drag-select UI

## Deployment
1. `vercel link` - Create Vercel project
2. Create Postgres in Vercel Dashboard → Storage
3. Run `lib/db/schema.sql` in Vercel Dashboard Query tab
4. Add `ANTHROPIC_API_KEY` env var
5. `git push origin main` - Deploy
