import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getStatusColors = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("statusColors").collect();
    return rows;
  },
});

export const setStatusColor = mutation({
  args: { key: v.string(), color: v.string() },
  handler: async (ctx, { key, color }) => {
    // Linear scan acceptable (small list); replace with index query when types align
    const rows = await ctx.db.query("statusColors").collect();
    const existing = rows.find((r) => r.key === key);
    if (existing) {
      await ctx.db.patch(existing._id, { color });
      return existing._id;
    }
    return await ctx.db.insert("statusColors", { key, color });
  },
});
