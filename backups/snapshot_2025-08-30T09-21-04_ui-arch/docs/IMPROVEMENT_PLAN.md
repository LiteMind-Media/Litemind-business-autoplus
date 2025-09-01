# Project Improvement & Hardening Plan

> Living document to track architectural, reliability, performance, security and UX improvements. Update status columns as tasks progress.

---

## Legend

- [ ] Not started
- [~] In progress
- [x] Done
- (!) Blocked / Needs input

---

## Phase 0 – Baseline & Guardrails

| Task                                                 | Status | Notes                   |
| ---------------------------------------------------- | ------ | ----------------------- |
| Pin deps & lock CI with `npm ci`                     | [ ]    |                         |
| Add `metadataBase` to layout                         | [ ]    | Removes Next.js warning |
| CONTRIBUTING.md + Architecture overview              | [ ]    |                         |
| Husky + lint-staged (eslint, tsc --noEmit, prettier) | [ ]    |                         |

## Phase 1 – Observability & Error Surfacing

| Task                                              | Status | Notes |
| ------------------------------------------------- | ------ | ----- |
| Central logger util (strip verbose in prod)       | [ ]    |       |
| Global error boundary + toast                     | [ ]    |       |
| Convex call wrapper + retry/backoff               | [ ]    |       |
| Instrument brand save / import / bulk ops timings | [ ]    |       |

## Phase 2 – Domain Schemas & Validation

| Task                                                         | Status | Notes                         |
| ------------------------------------------------------------ | ------ | ----------------------------- |
| Add zod (or valibot) dependency                              | [ ]    |                               |
| Schemas: BrandIdentity, Customer, Theme, StatusColors, Goals | [ ]    | Shared types front+backend    |
| Server-side validation in Convex mutations                   | [ ]    | Reject with structured errors |
| Normalization utilities (phone/email/trim)                   | [ ]    |                               |

## Phase 3 – Brand & Theme Stabilization

| Task                                            | Status | Notes                         |
| ----------------------------------------------- | ------ | ----------------------------- |
| Extract `useBrandIdentity` hook (state machine) | [ ]    | Idle→Dirty→Saving→Saved/Error |
| Diff-based payload sending                      | [ ]    | Reduce conflicts & size       |
| Optimistic save + rollback                      | [ ]    | Visual last-saved timestamp   |
| Asset validation (mime, size, dimensions)       | [ ]    | Drop oversize early           |
| Favicon multi-size generation (defer)           | [ ]    | Optional                      |

## Phase 4 – Customer Import Pipeline

| Task                                             | Status | Notes                         |
| ------------------------------------------------ | ------ | ----------------------------- |
| `useCustomerImport` hook                         | [ ]    | Encapsulate pipeline          |
| Pre-parse validation (headers, row cap)          | [ ]    | e.g. 10k rows limit           |
| Preview & per-row error reporting                | [ ]    |                               |
| Chunked bulk upserts                             | [ ]    | Prevent large single mutation |
| Import metrics (created/updated/merged/rejected) | [ ]    | Display summary               |

## Phase 5 – File Decomposition / Architecture

| Task                                                | Status | Notes                                           |
| --------------------------------------------------- | ------ | ----------------------------------------------- |
| Split `page.tsx` into feature folders               | [ ]    | Branding, Customers, Analytics, Settings, Goals |
| Extract UI primitives (Panel, StatCard, IconButton) | [ ]    | Reusable styling                                |
| Move helper components out of render body           | [ ]    | Perf improvement                                |
| Thin page orchestrator pattern                      | [ ]    | Hooks + presentational components               |

## Phase 6 – Performance & UX

| Task                                 | Status | Notes                    |
| ------------------------------------ | ------ | ------------------------ |
| Memoize heavy derived data           | [ ]    | Sorted/filtered lists    |
| Dynamic import heavy panels          | [ ]    | Settings/Analytics       |
| Remove inline lambdas in large lists | [ ]    | Stable callbacks         |
| (Future) Virtualize large tables     | [ ]    | When row count high      |
| Keyboard & focus accessibility pass  | [ ]    | ARIA labels, focus rings |
| Contrast audit & auto-adjust         | [ ]    | Dark mode readability    |

## Phase 7 – Testing Strategy

| Task                                  | Status | Notes                     |
| ------------------------------------- | ------ | ------------------------- |
| Add Vitest + RTL setup                | [ ]    |                           |
| Brand diff tests                      | [ ]    | Edge cases (no changes)   |
| CSV validator tests                   | [ ]    | Missing headers, oversize |
| Customer normalization & dedupe tests | [ ]    |                           |
| Undo/redo reducer tests               | [ ]    | Branching scenario        |
| Coverage thresholds (≥70% domain)     | [ ]    | Raise over time           |

## Phase 8 – Generic Sync Abstraction

| Task                                            | Status | Notes               |
| ----------------------------------------------- | ------ | ------------------- |
| Implement `useSyncedDocument`                   | [ ]    | Key/fetch/save/diff |
| Retrofit brand/theme/status colors              | [ ]    | Unified logic       |
| Standard status object (state/error/timestamps) | [ ]    | UI consistency      |

## Phase 9 – Goals & Analytics Hardening

| Task                             | Status | Notes           |
| -------------------------------- | ------ | --------------- |
| Pure metric calculators w/ tests | [ ]    | Deterministic   |
| Document metric definitions      | [ ]    | Avoid ambiguity |
| Cache / memo analytics layers    | [ ]    | Perf            |

## Phase 10 – Security & Data Hygiene

| Task                                              | Status | Notes                     |
| ------------------------------------------------- | ------ | ------------------------- |
| Input sanitization (control chars)                | [ ]    |                           |
| Row & rate limits (import/bulk)                   | [ ]    | Convex wrapper            |
| URL validation for domain fields                  | [ ]    | Prevent injection         |
| Auth & roles integration (see separate auth plan) | [ ]    | Owner/Admin/Member/Viewer |

## Phase 11 – Accessibility & i18n Prep

| Task                           | Status | Notes          |
| ------------------------------ | ------ | -------------- |
| Add eslint-plugin-jsx-a11y     | [ ]    | Fix violations |
| Landmarks & semantic structure | [ ]    | main/nav/aside |
| Externalize UI strings         | [ ]    | Future i18n    |

## Phase 12 – Documentation & DX

| Task                           | Status | Notes                |
| ------------------------------ | ------ | -------------------- |
| Architecture.md                | [ ]    | Data flow diagrams   |
| DataContracts.md               | [ ]    | Schemas & invariants |
| Playbook.md (import, branding) | [ ]    | Ops handbook         |
| Storybook/Ladle setup          | [ ]    | Visual components    |

## Phase 13 – CI/CD & Deployment

| Task                                     | Status | Notes              |
| ---------------------------------------- | ------ | ------------------ |
| GitHub Actions (lint, type, test, build) | [ ]    | Failing PR gate    |
| Preview deployments                      | [ ]    | Vercel PR previews |
| Sentry (optional) integration            | [ ]    | Error tracking     |

## Phase 14 – Backlog / Future

| Task                               | Status | Notes                |
| ---------------------------------- | ------ | -------------------- |
| Asset offload (object storage)     | [ ]    | Replace base64 blobs |
| Real-time collaboration presence   | [ ]    | Multi-user editing   |
| Advanced search & filters (server) | [ ]    | Scalability          |
| Role invites & audit log UI        | [ ]    | Governance           |
| State machine adoption (XState)    | [ ]    | Complex flows        |

---

## Execution Order (Condensed)

0 Baseline → 1 Observability → 2 Schemas → 3 Brand → 4 Import → 5 Decompose → 6 Perf/UX → 7 Tests (continuous) → 8 Sync abstraction → 9 Analytics → 10 Security → 11 A11y → 12 Docs → 13 CI → 14 Future backlog.

---

## Immediate Next (Editable)

- [ ] Add zod & start schemas
- [ ] Extract `useBrandIdentity`
- [ ] Move SettingsPanel out of `page.tsx`
- [ ] Implement diff-based brand save
- [ ] Add initial Vitest config

---

## Notes / Decisions Log

| Date   | Decision | Rationale |
| ------ | -------- | --------- |
| (fill) |          |           |

---

## Open Questions

| Topic  | Question                            | Owner |
| ------ | ----------------------------------- | ----- |
| Auth   | Which provider (NextAuth vs Clerk)? |       |
| Import | Max CSV size & row cap?             |       |
| Assets | External storage timeline?          |       |

---

_Update this file as tasks progress. Keep commits granular (one phase sub-task per commit when possible)._
