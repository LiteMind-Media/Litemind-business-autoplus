import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  brandSettings: defineTable({
    name: v.string(),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    updatedAt: v.string(),
  }),
  themeSettings: defineTable({
    from: v.string(),
    via: v.string(),
    to: v.string(),
    background: v.string(),
    cardBg: v.string(),
    mutedBg: v.string(),
    border: v.string(),
    primaryText: v.string(),
    secondaryText: v.string(),
    sidebarText: v.string(),
    headerText: v.string(),
    updatedAt: v.string(),
  }),
  goals: defineTable({
    chiefAim: v.number(),
    sweetSpot: v.number(),
    win: v.number(),
    affirmation: v.string(),
    presets: v.array(
      v.object({ id: v.string(), name: v.string(), value: v.number() })
    ),
    updatedAt: v.string(),
  }),
  statusColors: defineTable({
    key: v.string(),
    color: v.string(),
  }),
  customers: defineTable({
    // Core identity & contact
    leadId: v.string(), // original id or synthesized
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    country: v.optional(v.string()),
    source: v.string(),
    // Dates / pipeline
    dateAdded: v.string(),
    firstCallDate: v.string(),
    firstCallStatus: v.string(),
    notes: v.string(),
    secondCallDate: v.string(),
    secondCallStatus: v.string(),
    secondCallNotes: v.string(),
    finalCallDate: v.string(),
    finalStatus: v.string(),
    finalNotes: v.string(),
    // Enrichment
    pronouns: v.optional(v.string()),
    device: v.optional(v.string()),
    leadScore: v.optional(v.number()),
    lastUpdated: v.optional(v.string()),
    lastMessageSnippet: v.optional(v.string()),
    messageCount: v.optional(v.number()),
    duplicatePhones: v.optional(v.array(v.string())),
    duplicateLeadIds: v.optional(v.array(v.string())),
    duplicateDateAdds: v.optional(v.array(v.string())),
  })
    .index("by_leadId", ["leadId"])
    .index("by_phone", ["phone"])
    .index("by_source", ["source"]),
});
