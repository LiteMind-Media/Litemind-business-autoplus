import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listInstances = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("instances").collect();
  },
});

export const getInstance = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const rows = await ctx.db
      .query("instances")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();
    return rows[0] || null;
  },
});

export const createInstance = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    tier: v.string(),
    allowedFeatures: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("instances")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .collect();
    if (existing.length) throw new Error("Instance slug already exists");
    const now = new Date().toISOString();
    const id = await ctx.db.insert("instances", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const updateInstance = mutation({
  args: {
    slug: v.string(),
    name: v.optional(v.string()),
    tier: v.optional(v.string()),
    allowedFeatures: v.optional(v.array(v.string())),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, { slug, ...rest }) => {
    const rows = await ctx.db
      .query("instances")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();
    if (!rows[0]) throw new Error("Instance not found");
    await ctx.db.patch(rows[0]._id, {
      ...rest,
      updatedAt: new Date().toISOString(),
    });
    return rows[0]._id;
  },
});

// Duplicate (clone) an existing instance's brand + theme + status colors into a new instance skeleton
export const cloneInstance = mutation({
  args: {
    sourceSlug: v.string(),
    targetSlug: v.string(),
    targetName: v.string(),
    tier: v.string(),
  },
  handler: async (ctx, { sourceSlug, targetSlug, targetName, tier }) => {
    const existingTarget = await ctx.db
      .query("instances")
      .withIndex("by_slug", (q) => q.eq("slug", targetSlug))
      .collect();
    if (existingTarget.length) throw new Error("Target slug already exists");

    const sourceInstance = await ctx.db
      .query("instances")
      .withIndex("by_slug", (q) => q.eq("slug", sourceSlug))
      .collect();
    if (!sourceInstance[0]) throw new Error("Source instance not found");

    const now = new Date().toISOString();
    const newInstanceId = await ctx.db.insert("instances", {
      slug: targetSlug,
      name: targetName,
      tier,
      allowedFeatures: sourceInstance[0].allowedFeatures,
      createdAt: now,
      updatedAt: now,
    });

    // Copy latest brand settings from source (if any) using instance slug as instanceId reference
    const brands = await ctx.db
      .query("brandSettings")
      .withIndex("by_instance", (q) => q.eq("instanceId", sourceSlug))
      .collect();
    brands.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const sourceBrand = brands[0];
    if (sourceBrand) {
      await ctx.db.insert("brandSettings", {
        instanceId: targetSlug,
        name: targetName,
        logoUrl: sourceBrand.logoUrl,
        faviconUrl: sourceBrand.faviconUrl,
        logoHorizontal: sourceBrand.logoHorizontal,
        logoHorizontalDark: sourceBrand.logoHorizontalDark,
        logoVertical: sourceBrand.logoVertical,
        logoIcon: sourceBrand.logoIcon,
        faviconData: sourceBrand.faviconData,
        logoVariant: sourceBrand.logoVariant,
        logoSize: sourceBrand.logoSize,
        domainPrimary: sourceBrand.domainPrimary,
        domainLanding: sourceBrand.domainLanding,
        domainFormEndpoint: sourceBrand.domainFormEndpoint,
        domainApiBase: sourceBrand.domainApiBase,
        colors: sourceBrand.colors,
        statusColorsSnapshot: sourceBrand.statusColorsSnapshot,
        updatedAt: now,
      });
    }

    // Copy theme settings scoped to source instance only
    const themeScoped = await ctx.db
      .query("themeSettings")
      .withIndex("by_instance", (q) => q.eq("instanceId", sourceSlug))
      .collect();
    themeScoped.sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
    const srcTheme = themeScoped[0];
    if (srcTheme) {
      const {
        _id: _omitId,
        _creationTime: _omitCreation,
        instanceId: _oldInstanceId,
        ...restTheme
      } = srcTheme as any;
      await ctx.db.insert("themeSettings", {
        ...restTheme,
        instanceId: targetSlug,
        updatedAt: now,
      });
    }

    // Copy status colors scoped to source instance only (all entries)
    const statusColorsScoped = await ctx.db
      .query("statusColors")
      .withIndex("by_instance", (q) => q.eq("instanceId", sourceSlug))
      .collect();
    for (const s of statusColorsScoped) {
      await ctx.db.insert("statusColors", {
        key: s.key,
        color: s.color,
        instanceId: targetSlug,
      });
    }
    return newInstanceId;
  },
});
