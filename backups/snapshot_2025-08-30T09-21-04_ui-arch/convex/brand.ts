import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getBrand = query({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    if (instanceId) {
      // Use instance index for scoped fetch (could use by_instance_updated when Convex supports ordering on composite)
      const scoped = await ctx.db
        .query("brandSettings")
        .withIndex("by_instance", (q) => q.eq("instanceId", instanceId))
        .collect();
      scoped.sort((a, b) =>
        (b.updatedAt || "").localeCompare(a.updatedAt || "")
      );
      return scoped[0] || null;
    }
    // Global (no instance) brand rows (legacy) => filter for rows without instanceId
    const all = await ctx.db
      .query("brandSettings")
      .withIndex("by_instance", (q) => q.eq("instanceId", undefined as any))
      .collect()
      .catch(async () => {
        // Fallback: full scan if index cannot match undefined
        const full = await ctx.db.query("brandSettings").collect();
        return full.filter((b) => !b.instanceId);
      });
    all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return all[0] || null;
  },
});

export const setBrand = mutation({
  args: {
    instanceId: v.optional(v.string()),
    name: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    faviconUrl: v.optional(v.string()),
    logoHorizontal: v.optional(v.string()),
    logoHorizontalDark: v.optional(v.string()),
    logoVertical: v.optional(v.string()),
    logoIcon: v.optional(v.string()),
    faviconData: v.optional(v.string()),
    logoVariant: v.optional(v.string()),
    logoSize: v.optional(v.number()),
    domainPrimary: v.optional(v.string()),
    domainLanding: v.optional(v.string()),
    domainFormEndpoint: v.optional(v.string()),
    domainApiBase: v.optional(v.string()),
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
        mode: v.optional(v.string()),
        backgroundRadialCenter: v.optional(v.string()),
        backgroundRadialEdge: v.optional(v.string()),
      })
    ),
    // Allows partial color updates without sending the full object (merged server-side)
    colorsPatch: v.optional(
      v.object({
        gradientFrom: v.optional(v.string()),
        gradientVia: v.optional(v.string()),
        gradientTo: v.optional(v.string()),
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
      })
    ),
    statusColorsSnapshot: v.optional(
      v.array(v.object({ key: v.string(), color: v.string() }))
    ),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    try {
      // Lookup existing (scoped or global)
      let existing: any = null;
      if (args.instanceId) {
        const rows = await ctx.db
          .query("brandSettings")
          .withIndex("by_instance", (q) => q.eq("instanceId", args.instanceId!))
          .collect();
        rows.sort((a, b) =>
          (b.updatedAt || "").localeCompare(a.updatedAt || "")
        );
        existing = rows[0] || null;
      } else {
        const rows = await ctx.db.query("brandSettings").collect();
        const globals = rows.filter((r) => !r.instanceId);
        globals.sort((a, b) =>
          (b.updatedAt || "").localeCompare(a.updatedAt || "")
        );
        existing = globals[0] || null;
      }
      // Soft size guard for inline assets
      const MAX_INLINE = 300_000;
      const sanitizeDataUrl = (v?: string) =>
        v && v.length > MAX_INLINE ? undefined : v;
      const defaultColors = {
        gradientFrom: "#6366f1",
        gradientVia: "#8b5cf6",
        gradientTo: "#ec4899",
        background: "#ffffff",
        cardBg: "#ffffffb3",
        mutedBg: "#f3f4f6",
        border: "#e5e7eb",
        primaryText: "#111827",
        secondaryText: "#6b7280",
        sidebarText: "#374151",
        headerText: "#111827",
        mode: "light" as string | undefined,
        backgroundRadialCenter: "#ffffff",
        backgroundRadialEdge: "#ffffff00",
      };
      let mergedColors: any;
      if (args.colors) mergedColors = args.colors;
      else if (args.colorsPatch)
        mergedColors = {
          ...(existing?.colors || defaultColors),
          ...args.colorsPatch,
        };
      const payload = {
        name: args.name ?? existing?.name ?? "Parlay Pros",
        logoUrl: sanitizeDataUrl(args.logoUrl) ?? existing?.logoUrl ?? "",
        faviconUrl:
          sanitizeDataUrl(args.faviconUrl) ?? existing?.faviconUrl ?? "",
        logoHorizontal:
          sanitizeDataUrl(args.logoHorizontal) ??
          existing?.logoHorizontal ??
          "",
        logoHorizontalDark:
          sanitizeDataUrl(args.logoHorizontalDark) ??
          existing?.logoHorizontalDark ??
          "",
        logoVertical:
          sanitizeDataUrl(args.logoVertical) ?? existing?.logoVertical ?? "",
        logoIcon: sanitizeDataUrl(args.logoIcon) ?? existing?.logoIcon ?? "",
        faviconData:
          sanitizeDataUrl(args.faviconData) ?? existing?.faviconData ?? "",
        logoVariant: args.logoVariant ?? existing?.logoVariant ?? "text",
        logoSize: args.logoSize ?? existing?.logoSize ?? 1,
        domainPrimary: args.domainPrimary ?? existing?.domainPrimary ?? "",
        domainLanding: args.domainLanding ?? existing?.domainLanding ?? "",
        domainFormEndpoint:
          args.domainFormEndpoint ?? existing?.domainFormEndpoint ?? "",
        domainApiBase: args.domainApiBase ?? existing?.domainApiBase ?? "",
        colors: mergedColors,
        statusColorsSnapshot:
          args.statusColorsSnapshot ?? existing?.statusColorsSnapshot ?? [],
        updatedAt: now,
        instanceId: args.instanceId,
      } as const;
      // Diagnostics: approximate size & asset lengths (after payload assembled)
      try {
        console.log("[brand:setBrand diagnostics]", {
          instanceId: args.instanceId,
          existingId: existing?._id,
          approxSize: JSON.stringify(payload).length,
          name: payload.name,
          assetSizes: {
            logoHorizontal: (payload.logoHorizontal || "").length,
            logoHorizontalDark: (payload.logoHorizontalDark || "").length,
            logoVertical: (payload.logoVertical || "").length,
            logoIcon: (payload.logoIcon || "").length,
            faviconData: (payload.faviconData || "").length,
          },
        });
      } catch {}
      // Skip write if nothing changed (reduces mutation pressure / race potential)
      const shallowEqual = (a: any, b: any) => {
        if (!a || !b) return false;
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of keys) {
          const va = (a as any)[k];
          const vb = (b as any)[k];
          if (typeof va === "object" && typeof vb === "object" && va && vb) {
            if (JSON.stringify(va) !== JSON.stringify(vb)) return false;
          } else if (va !== vb) return false;
        }
        return true;
      };
      if (existing) {
        const existingComparable = { ...existing };
        // remove Convex internal fields for comparison
        delete (existingComparable as any)._id;
        delete (existingComparable as any)._creationTime;
        if (shallowEqual(existingComparable, payload)) {
          return existing._id; // no-op
        }
      }
      // Doc size diagnostics before write
      const approxSize = JSON.stringify(payload).length;
      if (approxSize > 950_000) {
        throw new Error("brand_payload_too_large:" + approxSize);
      }
      try {
        console.log(
          "[setBrand diagnostics] instance",
          args.instanceId,
          "existing",
          existing?._id,
          "approxSize",
          approxSize,
          "fieldLengths",
          {
            logoHorizontal: (payload.logoHorizontal || "").length,
            logoHorizontalDark: (payload.logoHorizontalDark || "").length,
            logoVertical: (payload.logoVertical || "").length,
            logoIcon: (payload.logoIcon || "").length,
            faviconData: (payload.faviconData || "").length,
          }
        );
      } catch {}
      if (existing) {
        try {
          await ctx.db.patch(existing._id, payload as any);
        } catch (err: any) {
          // Provide secondary logging context
          console.error("[setBrand patch failed]", err?.message || err);
          throw err;
        }
        return existing._id;
      }
      const id = await ctx.db.insert("brandSettings", payload as any);
      return id;
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error("setBrand error enriched", msg);
      // Append safe metadata for caller (avoid huge base64) via tokenized hints
      throw new Error("setBrand_failed_enriched:" + msg);
    }
  },
});

// Create or refresh a snapshot of current theme + status colors in brand settings.
export const snapshotBrandColors = mutation({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    // Fetch current theme scoped (fallback to global latest if none scoped yet)
    let themeRows = await ctx.db.query("themeSettings").collect();
    if (instanceId)
      themeRows = themeRows.filter((t) => t.instanceId === instanceId);
    themeRows.sort((a, b) =>
      (b.updatedAt || "").localeCompare(a.updatedAt || "")
    );
    const theme = themeRows[0];
    // Fetch status colors scoped
    let statusColors = await ctx.db.query("statusColors").collect();
    if (instanceId)
      statusColors = statusColors.filter((s) => s.instanceId === instanceId);
    // Find brand row for this instance (or global default if no instanceId)
    let brands = await ctx.db.query("brandSettings").collect();
    brands = brands.filter((b) =>
      instanceId ? b.instanceId === instanceId : !b.instanceId
    );
    brands.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const existing = brands[0];
    const now = new Date().toISOString();
    const colors = theme
      ? {
          gradientFrom: (theme as any).from,
          gradientVia: (theme as any).via,
          gradientTo: (theme as any).to,
          background: (theme as any).background,
          cardBg: (theme as any).cardBg,
          mutedBg: (theme as any).mutedBg,
          border: (theme as any).border,
          primaryText: (theme as any).primaryText,
          secondaryText: (theme as any).secondaryText,
          sidebarText: (theme as any).sidebarText,
          headerText: (theme as any).headerText,
          mode: (theme as any).mode,
          backgroundRadialCenter: (theme as any).backgroundRadialCenter,
          backgroundRadialEdge: (theme as any).backgroundRadialEdge,
        }
      : undefined;
    const snap = statusColors.map((s) => ({ key: s.key, color: s.color }));
    if (existing) {
      await ctx.db.patch(existing._id, {
        colors: colors || existing.colors,
        statusColorsSnapshot: snap,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("brandSettings", {
      instanceId,
      name: "Parlay Pros",
      logoUrl: "",
      faviconUrl: "",
      colors: colors || {
        gradientFrom: "#6366f1",
        gradientVia: "#8b5cf6",
        gradientTo: "#ec4899",
        background: "#ffffff",
        cardBg: "#ffffffb3",
        mutedBg: "#f3f4f6",
        border: "#e5e7eb",
        primaryText: "#111827",
        secondaryText: "#6b7280",
        sidebarText: "#374151",
        headerText: "#111827",
        mode: "light",
        backgroundRadialCenter: "#ffffff",
        backgroundRadialEdge: "#ffffff00",
      },
      statusColorsSnapshot: snap,
      updatedAt: now,
    });
  },
});

// Apply snapshot back into theme & statusColors collections (restoration after fresh deploy)
export const applyBrandColors = mutation({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    // Choose brand snapshot for this instance (or global)
    let brands = await ctx.db.query("brandSettings").collect();
    brands = brands.filter((b) =>
      instanceId ? b.instanceId === instanceId : !b.instanceId
    );
    brands.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const brand = brands[0];
    if (!brand || !brand.colors) return "no-snapshot";
    const now = new Date().toISOString();
    // Theme: only operate within this instance scope
    let themes = await ctx.db.query("themeSettings").collect();
    themes = themes.filter((t) =>
      instanceId ? t.instanceId === instanceId : !t.instanceId
    );
    themes.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const existingTheme = themes[0];
    const themePayload = {
      instanceId,
      from: brand.colors.gradientFrom,
      via: brand.colors.gradientVia,
      to: brand.colors.gradientTo,
      background: brand.colors.background,
      cardBg: brand.colors.cardBg,
      mutedBg: brand.colors.mutedBg,
      border: brand.colors.border,
      primaryText: brand.colors.primaryText,
      secondaryText: brand.colors.secondaryText,
      sidebarText: brand.colors.sidebarText,
      headerText: brand.colors.headerText,
      mode: (brand.colors as any).mode,
      backgroundRadialCenter: (brand.colors as any).backgroundRadialCenter,
      backgroundRadialEdge: (brand.colors as any).backgroundRadialEdge,
      updatedAt: now,
    } as any;
    if (existingTheme) await ctx.db.patch(existingTheme._id, themePayload);
    else await ctx.db.insert("themeSettings", themePayload);
    // Status colors restore for this instance
    if (brand.statusColorsSnapshot && brand.statusColorsSnapshot.length) {
      let existingStatuses = await ctx.db.query("statusColors").collect();
      existingStatuses = existingStatuses.filter((s) =>
        instanceId ? s.instanceId === instanceId : !s.instanceId
      );
      for (const snap of brand.statusColorsSnapshot) {
        const match = existingStatuses.find((e) => e.key === snap.key);
        if (match) await ctx.db.patch(match._id, { color: snap.color });
        else
          await ctx.db.insert("statusColors", {
            instanceId,
            key: snap.key,
            color: snap.color,
          });
      }
    }
    return "applied";
  },
});

// Debug helper: returns size metadata of latest brand document (for diagnosing oversized payload issues)
export const debugBrandMeta = query({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    let rows = await ctx.db.query("brandSettings").collect();
    rows = rows.filter((r) =>
      instanceId ? r.instanceId === instanceId : !r.instanceId
    );
    rows.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    const doc = rows[0];
    if (!doc) return { found: false };
    const size = (s?: string) => (s ? s.length : 0);
    const fieldSizes: Record<string, number> = {
      logoUrl: size((doc as any).logoUrl),
      faviconUrl: size((doc as any).faviconUrl),
      logoHorizontal: size((doc as any).logoHorizontal),
      logoHorizontalDark: size((doc as any).logoHorizontalDark),
      logoVertical: size((doc as any).logoVertical),
      logoIcon: size((doc as any).logoIcon),
      faviconData: size((doc as any).faviconData),
      statusColorsSnapshotJson: JSON.stringify(
        (doc as any).statusColorsSnapshot || []
      ).length,
      colorsJson: JSON.stringify((doc as any).colors || {}).length,
    };
    const totalApprox = JSON.stringify(doc).length;
    return {
      found: true,
      id: doc._id,
      updatedAt: (doc as any).updatedAt,
      fieldSizes,
      totalApprox,
    };
  },
});
