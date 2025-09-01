import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getTheme = query({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    if (instanceId) {
      const rows = await ctx.db
        .query("themeSettings")
        .withIndex("by_instance", (q) => q.eq("instanceId", instanceId))
        .collect();
      rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      return rows[0] || null;
    }
    const all = await ctx.db.query("themeSettings").collect();
    all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return all[0] || null;
  },
});

export const setTheme = mutation({
  args: {
    instanceId: v.optional(v.string()),
    from: v.optional(v.string()),
    via: v.optional(v.string()),
    to: v.optional(v.string()),
    background: v.optional(v.string()),
    cardBg: v.optional(v.string()),
    mutedBg: v.optional(v.string()),
    border: v.optional(v.string()),
    primaryText: v.optional(v.string()),
    secondaryText: v.optional(v.string()),
    sidebarText: v.optional(v.string()),
    headerText: v.optional(v.string()),
    mode: v.optional(v.string()),
    backgroundRadialCenter: v.optional(v.string()),
    backgroundRadialEdge: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    let existing;
    if (args.instanceId) {
      existing = await ctx.db
        .query("themeSettings")
        .withIndex("by_instance", (q) => q.eq("instanceId", args.instanceId!))
        .collect()
        .then(
          (rows) =>
            rows.sort((a, b) =>
              (b.updatedAt || "").localeCompare(a.updatedAt || "")
            )[0]
        );
    } else {
      const all = await ctx.db.query("themeSettings").collect();
      all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      existing = all[0];
    }
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    const mode = args.mode || "light";
    if (mode === "dark") {
      return await ctx.db.insert("themeSettings", {
        instanceId: args.instanceId,
        from: args.from || "#111827",
        via: args.via || "#1f2937",
        to: args.to || "#374151",
        background: args.background || "#0f1115",
        cardBg: args.cardBg || "#1f2937",
        mutedBg: args.mutedBg || "#111827",
        border: args.border || "#374151",
        primaryText: args.primaryText || "#f3f4f6",
        secondaryText: args.secondaryText || "#9ca3af",
        sidebarText: args.sidebarText || "#e5e7eb",
        headerText: args.headerText || "#f9fafb",
        mode,
        backgroundRadialCenter: args.backgroundRadialCenter || "#ffffff",
        backgroundRadialEdge: args.backgroundRadialEdge || "#ffffff00",
        updatedAt: now,
      });
    }
    return await ctx.db.insert("themeSettings", {
      instanceId: args.instanceId,
      from: args.from || "#6366f1",
      via: args.via || "#8b5cf6",
      to: args.to || "#ec4899",
      background: args.background || "#ffffff",
      cardBg: args.cardBg || "#ffffffb3",
      mutedBg: args.mutedBg || "#f3f4f6",
      border: args.border || "#e5e7eb",
      primaryText: args.primaryText || "#111827",
      secondaryText: args.secondaryText || "#6b7280",
      sidebarText: args.sidebarText || "#374151",
      headerText: args.headerText || "#111827",
      mode,
      backgroundRadialCenter: args.backgroundRadialCenter || "#ffffff",
      backgroundRadialEdge: args.backgroundRadialEdge || "#ffffff00",
      updatedAt: now,
    });
  },
});
