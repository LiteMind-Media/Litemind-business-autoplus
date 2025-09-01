# Convex Integration Plan

## Goals

Real-time, multi-device persistence for:

- Brand identity (name, logo, favicon)
- Theme & custom status colors
- Goals & affirmation
- Customers / leads (future migration from local / CSV)
- Settings (appearance, notifications placeholders)

## Phased Approach

1. Bootstrap Convex backend (schema + basic queries/mutations)
2. Integrate Convex client provider in Next.js layout
3. Migrate brand identity from localStorage to Convex (optimistic updates)
4. Migrate theme & status colors
5. Migrate goals & affirmation
6. (Optional) Migrate customers dataset & introduce real-time updates
7. Add file upload support (logo/favicon) via Convex storage or signed URLs
8. Add access control / multi-tenant instance key
9. Implement subscriptions for live UI refresh

## Data Model (Initial)

```
brandSettings: { _id, name, logoUrl?, faviconUrl?, updatedAt }
themeSettings: { _id, from, via, to, background, cardBg, mutedBg, border, primaryText, secondaryText, sidebarText, headerText, updatedAt }
statusColors: { _id, key, color }
goals: { _id, chiefAim, sweetSpot, win, affirmation, presets: [{ id, name, value }], updatedAt }
```

Later:

```
customers: { _id, name, phone, email?, source, firstCallStatus, secondCallStatus, finalStatus, notes, firstCallNotes, secondCallNotes, finalNotes, dateAdded, updatedAt }
```

## Queries & Mutations (Round 1)

Queries:

- getBrand
- getTheme
- getStatusColors
- getGoals

Mutations:

- setBrand({ name?, logoUrl?, faviconUrl? })
- setTheme(partialTheme)
- setStatusColor({ key, color })
- setGoals(partialGoals)
- addGoalPreset({ name, value }) / removeGoalPreset(id)

## Optimistic UI Strategy

1. Local React state updates first.
2. Fire mutation; on error revert and show toast (future toast util).
3. Queries subscribe to Convex for real-time reflection on other devices.

## File Upload Strategy

Option A (simpler initial): Encode as data URL and store directly (fast prototype; size limit ~100KB).
Option B (recommended): Use Convex storage API -> return public URL -> store URL in brandSettings.

## Access Control

- Phase 1: Single shared instance (no auth) to move fast.
- Phase 2: Add user auth + instanceId field on every document (multi-tenant separation).

## Migration Notes

- Keep existing localStorage reads as _initial fallback_; once Convex returns data, override.
- Write a one-time sync routine (if Convex empty, push local state after load).

## Edge Cases

- First-time load: queries return null -> create defaults via bootstrap mutation.
- Network offline: continue with last locally cached state (to be added via simple cache layer).
- Large customer imports: batch mutations / server-side CSV ingest (future).

## Step-by-Step Implementation

1. Install Convex: `npm i convex`
2. Init: `npx convex dev` (creates `convex/` folder & `.env.local` with deployment URL)
3. Create `convex/schema.ts` with tables above.
4. Implement queries/mutations in `convex/` directory.
5. Add Convex provider in `src/app/layout.tsx` wrapping body.
6. Create hooks: `useBrandSettings`, `useThemeSettings`, etc. (thin wrappers around `useQuery` / `useMutation`).
7. Replace brand identity localStorage logic with hook (optimistic updates + fallback load).
8. Replace theme logic similarly (or merge into existing `useTheme` with remote sync layer).
9. Add status colors & goals persistence.
10. Add upload mutation for logo/favicon.
11. Remove local-only persistence once stable.

## Short-Term Deliverables

- [ ] Add Convex dependency & boot schema
- [ ] Provider in layout
- [ ] Brand settings query/mutation + UI wiring
- [ ] Theme settings query/mutation + UI wiring
- [ ] Status colors sync
- [ ] Goals sync

## Future Enhancements

- Role-based access
- Activity log / audit trail
- Batched imports with server parsing
- Webhook / external integrations
- Caching / offline support

## Testing Strategy

- Unit test schema & mutations with Convex testing utilities (later)
- Manual E2E: open two browsers, change brand name, observe live update

## Rollback Plan

- Keep localStorage writes temporarily; if Convex errors, UI continues to function.

## Performance Considerations

- Debounce text field mutations (300ms)
- Batch multiple theme color changes into one mutation
- Avoid storing large base64 images (prefer real storage URLs)

-- End of Plan --
