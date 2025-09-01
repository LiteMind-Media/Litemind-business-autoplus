import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getStatusColors = query({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    if (instanceId) {
      return await ctx.db
        .query("statusColors")
        .withIndex("by_instance", (q) => q.eq("instanceId", instanceId))
        .collect();
    }
    return await ctx.db.query("statusColors").collect();
  },
});

export const setStatusColor = mutation({
  args: {
    instanceId: v.optional(v.string()),
    key: v.string(),
    color: v.string(),
  },
  handler: async (ctx, { instanceId, key, color }) => {
    let existing;
    if (instanceId) {
      const scoped = await ctx.db
        .query("statusColors")
        .withIndex("by_instance_key", (q) =>
          q.eq("instanceId", instanceId).eq("key", key)
        )
        .unique();
      existing = scoped || null;
    } else {
      const rows = await ctx.db.query("statusColors").collect();
      existing = rows.find((r) => r.key === key) || null;
    }
    if (existing) {
      await ctx.db.patch(existing._id, { color });
      return existing._id;
    }
    return await ctx.db.insert("statusColors", { instanceId, key, color });
  },
});
