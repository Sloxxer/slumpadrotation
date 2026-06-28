# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Next.js dev server
npm run build            # Generate Prisma client + build Next.js
npm run start            # Run production server
npm run lint             # Run Next.js lint

npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:migrate   # Run new migrations (dev mode)
npm run prisma:studio    # Open Prisma GUI
```

After any change to `prisma/schema.prisma`, run `prisma:generate` before running the app.

## Environment

Copy `.env.example` to `.env`. Required variables:

```
DATABASE_URL="file:./prisma/dev.db"
SITE_ADMIN_PASSWORD="..."
```

## Architecture

**Next.js 15 App Router** with server actions — no API routes. All mutations go through `app/actions.ts` (server actions), pages read directly from Prisma.

**Auth** (`lib/auth.ts`): Two separate cookie sessions — per-department auth (8-hour TTL) and site admin auth. Department password is `passwordWord` + current minute joined, so it changes every minute by design.

**Rotation algorithm** (`lib/rotation.ts`): Assigns people to zones with a scoring system that penalizes repeated zones and adjacent neighbor repetition (circular layout). `generateRotationAction` in `actions.ts` compares against the last rotation to avoid repetition.

**Database** (`prisma/`): SQLite via Prisma. Core models: `Department → Zone | Group | Person → Rotation → RotationAssignment`. `AdminLog` stores an audit trail of all admin actions. Migration history is in `prisma/migrations/`.

**Validation** (`lib/validation.ts`): Zod schemas for all form inputs. Always validate through these schemas in server actions before touching the database.

**Admin logging** (`lib/admin.ts`): Call `logAdminEvent()` from server actions when making significant changes. Events are typed via the `AdminEventType` enum.

## Custom Tailwind tokens

| Token | Value | Usage |
|---|---|---|
| `sand` | `#f4efe6` | Page backgrounds |
| `ink` | `#10212b` | Primary text |
| `accent` | `#d96c3c` | CTAs, highlights |
| `teal` | `#2e6f73` | Secondary actions |
| `moss` | `#758b5c` | Tertiary/badges |
| `shadow-panel` | `0 20px 55px rgba(16,33,43,0.12)` | Cards |

## Key conventions

- UI language is **Swedish** throughout — keep labels, error messages, and placeholders in Swedish.
- Path alias `@/` maps to the repo root.
- `lib/utils.ts` exports `cn()` (clsx wrapper) and `formatDate()` (sv-SE locale).
- `lib/prisma.ts` exports a singleton Prisma client — always import from there, never instantiate directly.
- Pages that require auth call `requireDepartmentAuth(departmentId)` or `requireSiteAdminAuth()` from `lib/auth.ts` at the top and redirect on failure.
- After mutations, call `revalidatePath()` to bust the Next.js cache for affected routes.
