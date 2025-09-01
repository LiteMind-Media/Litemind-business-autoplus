import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  brandSettings: defineTable({
    // Instance scoping (multi-tenant). Older rows may not have this set; treat undefined as default/global.
    instanceId: v.optional(v.string()),
    name: v.string(),
    // Legacy single logo fields
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    // New variant-specific brand identity assets (stored as data URLs or remote URLs)
    logoHorizontal: v.optional(v.string()),
    logoHorizontalDark: v.optional(v.string()),
    logoVertical: v.optional(v.string()),
    logoIcon: v.optional(v.string()),
    faviconData: v.optional(v.string()),
    logoVariant: v.optional(v.string()),
    logoSize: v.optional(v.number()),
    // Domain / endpoint configuration per instance
    domainPrimary: v.optional(v.string()),
    domainLanding: v.optional(v.string()),
    domainFormEndpoint: v.optional(v.string()),
    domainApiBase: v.optional(v.string()),
    updatedAt: v.string(),
    // Optional full brand color snapshot so a deployment can restore all UI colors.
    colors: v.optional(
      v.object({
        gradientFrom: v.string(),
        gradientVia: v.string(),
        gradientTo: v.string(),
        background: v.string(),
        cardBg: v.string(),
        mutedBg: v.string(),
        border: v.string(),
        primaryText: v.string(),
        secondaryText: v.string(),
        sidebarText: v.string(),
        headerText: v.string(),
        // Added later: optional mode and radial background layers for snapshot completeness
        mode: v.optional(v.string()),
        backgroundRadialCenter: v.optional(v.string()),
        backgroundRadialEdge: v.optional(v.string()),
      })
    ),
    statusColorsSnapshot: v.optional(
      v.array(v.object({ key: v.string(), color: v.string() }))
    ),
  })
    .index("by_instance", ["instanceId"])
    .index("by_instance_updated", ["instanceId", "updatedAt"]),
  instances: defineTable({
    slug: v.string(), // URL-safe unique identifier (e.g. "parlay-pros")
    name: v.string(),
    tier: v.string(), // e.g. "light" | "pro" | "premium"
    allowedFeatures: v.optional(v.array(v.string())),
    createdAt: v.string(),
    updatedAt: v.string(),
    archived: v.optional(v.boolean()),
  }).index("by_slug", ["slug"]),
  themeSettings: defineTable({
    instanceId: v.optional(v.string()), // multi-tenant scope
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
    // Optional color mode (light | dark). Added later so kept optional for backward compatibility.
    mode: v.optional(v.string()),
    // Optional radial background layers (center & edge) for more nuanced backgrounds.
    backgroundRadialCenter: v.optional(v.string()),
    backgroundRadialEdge: v.optional(v.string()),
    updatedAt: v.string(),
  }).index("by_instance", ["instanceId"]),
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
    instanceId: v.optional(v.string()),
    key: v.string(),
    color: v.string(),
  })
    .index("by_instance", ["instanceId"])
    .index("by_instance_key", ["instanceId", "key"]),
  customers: defineTable({
    instanceId: v.optional(v.string()), // tenant scope
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
    .index("by_instance_leadId", ["instanceId", "leadId"]) // enables scoped upserts
    .index("by_instance_phone", ["instanceId", "phone"]) // for dedupe
    .index("by_instance_source", ["instanceId", "source"]) // analytics per source
    .index("by_leadId", ["leadId"]) // backward compatibility (legacy rows w/out instanceId)
    .index("by_phone", ["phone"]) // legacy
    .index("by_source", ["source"]), // legacy
});
