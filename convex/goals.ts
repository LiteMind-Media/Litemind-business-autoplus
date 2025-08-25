import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getGoals = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("goals").collect();
    all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return all[0] || null;
  },
});

export const setGoals = mutation({
  args: {
    chiefAim: v.optional(v.number()),
    sweetSpot: v.optional(v.number()),
    win: v.optional(v.number()),
    affirmation: v.optional(v.string()),
    presets: v.optional(
      v.array(v.object({ id: v.string(), name: v.string(), value: v.number() }))
    ),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const all = await ctx.db.query("goals").collect();
    all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const existing = all[0];
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("goals", {
      chiefAim: args.chiefAim || 0,
      sweetSpot: args.sweetSpot || 0,
      win: args.win || 0,
      affirmation: args.affirmation || "",
      presets: args.presets || [],
      updatedAt: now,
    });
  },
});
