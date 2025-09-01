import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getBrand = query({
  args: {},
  handler: async (ctx) => {
    // Fallback: scan and pick latest by updatedAt (small singleton table expected)
    const all = await ctx.db.query("brandSettings").collect();
    all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return all[0] || null;
  },
});

export const setBrand = mutation({
  args: {
    name: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const all = await ctx.db.query("brandSettings").collect();
    all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const existing = all[0];
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("brandSettings", {
      name: args.name || "Parlay Pros",
      logoUrl: args.logoUrl || "",
      faviconUrl: args.faviconUrl || "",
      updatedAt: now,
    });
  },
});
