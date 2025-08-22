import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  brandSettings: defineTable({
    name: v.string(),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    updatedAt: v.string(),
  }),
  themeSettings: defineTable({
    from: v.string(), via: v.string(), to: v.string(),
    background: v.string(), cardBg: v.string(), mutedBg: v.string(), border: v.string(),
    primaryText: v.string(), secondaryText: v.string(), sidebarText: v.string(), headerText: v.string(),
    updatedAt: v.string()
  }),
  goals: defineTable({
    chiefAim: v.number(), sweetSpot: v.number(), win: v.number(), affirmation: v.string(),
    presets: v.array(v.object({ id: v.string(), name: v.string(), value: v.number() })),
    updatedAt: v.string()
  }),
  statusColors: defineTable({
    key: v.string(), color: v.string()
  }),
});
