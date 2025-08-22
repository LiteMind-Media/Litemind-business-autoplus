import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const getTheme = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('themeSettings').collect();
    all.sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''));
    return all[0] || null;
  }
});

export const setTheme = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const all = await ctx.db.query('themeSettings').collect();
    all.sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''));
    const existing = all[0];
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert('themeSettings', { from:'#6366f1', via:'#8b5cf6', to:'#ec4899', background:'#ffffff', cardBg:'#ffffffb3', mutedBg:'#f3f4f6', border:'#e5e7eb', primaryText:'#111827', secondaryText:'#6b7280', sidebarText:'#374151', headerText:'#111827', updatedAt: now });
  }
});
