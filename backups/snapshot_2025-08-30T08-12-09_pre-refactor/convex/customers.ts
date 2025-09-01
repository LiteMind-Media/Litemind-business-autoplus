import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    if (instanceId) {
      return await ctx.db
        .query("customers")
        .withIndex("by_instance_leadId", (q) => q.eq("instanceId", instanceId))
        .collect();
    }
    return await ctx.db.query("customers").collect();
  },
});

export const bulkUpsert = mutation({
  args: {
    instanceId: v.optional(v.string()),
    customers: v.array(
      v.object({
        leadId: v.string(),
        name: v.string(),
        phone: v.string(),
        email: v.optional(v.string()),
        country: v.optional(v.string()),
        source: v.string(),
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
        pronouns: v.optional(v.string()),
        device: v.optional(v.string()),
        leadScore: v.optional(v.number()),
        lastUpdated: v.optional(v.string()),
        lastMessageSnippet: v.optional(v.string()),
        messageCount: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, { customers, instanceId }) => {
    for (const c of customers) {
      let existing;
      if (instanceId) {
        existing = await ctx.db
          .query("customers")
          .withIndex("by_instance_leadId", (q) =>
            q.eq("instanceId", instanceId).eq("leadId", c.leadId)
          )
          .unique();
      } else {
        existing = await ctx.db
          .query("customers")
          .withIndex("by_leadId", (q) => q.eq("leadId", c.leadId))
          .unique();
      }
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...c,
          instanceId: instanceId || existing.instanceId,
        });
      } else {
        await ctx.db.insert("customers", { ...c, instanceId });
      }
    }
    return { count: customers.length };
  },
});

export const remove = mutation({
  args: { leadId: v.string(), instanceId: v.optional(v.string()) },
  handler: async (ctx, { leadId, instanceId }) => {
    let existing;
    if (instanceId) {
      existing = await ctx.db
        .query("customers")
        .withIndex("by_instance_leadId", (q) =>
          q.eq("instanceId", instanceId).eq("leadId", leadId)
        )
        .unique();
    } else {
      existing = await ctx.db
        .query("customers")
        .withIndex("by_leadId", (q) => q.eq("leadId", leadId))
        .unique();
    }
    if (existing) await ctx.db.delete(existing._id);
    return { removed: !!existing };
  },
});

// Dedupe by normalized phone number (digits only). Keeps a canonical record per phone and merges sparse data.
export const dedupePhones = mutation({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    let all;
    if (instanceId) {
      all = await ctx.db
        .query("customers")
        .withIndex("by_instance_phone", (q) => q.eq("instanceId", instanceId))
        .collect();
    } else {
      all = await ctx.db.query("customers").collect();
    }
    const groups: Record<string, typeof all> = {} as any;
    for (const c of all) {
      if (!c.phone) continue;
      const norm = c.phone.replace(/\D+/g, "");
      if (!norm) continue;
      (groups[norm] ||= []).push(c as any);
    }
    let removed = 0;
    let merged = 0;
    const details: any[] = [];
    for (const norm of Object.keys(groups)) {
      const list = groups[norm];
      if (list.length < 2) continue;
      const score = (c: any) => {
        let s = 0;
        if (c.finalStatus === "Registered") s += 100;
        const fields = [
          "name",
          "email",
          "country",
          "source",
          "firstCallDate",
          "secondCallDate",
          "finalCallDate",
          "notes",
          "secondCallNotes",
          "finalNotes",
          "lastMessageSnippet",
        ];
        for (const f of fields) if (c[f]) s++;
        if (c.lastUpdated) s += 0.5;
        return s;
      };
      list.sort((a, b) => score(b) - score(a));
      const canonical = list[0];
      const dups = list.slice(1);
      const patch: Record<string, any> = {
        duplicatePhones: Array.from(
          new Set([
            ...((canonical as any).duplicatePhones || []),
            ...dups.map((d) => d.phone).filter((p) => p !== canonical.phone),
          ])
        ),
        duplicateLeadIds: Array.from(
          new Set([
            ...((canonical as any).duplicateLeadIds || []),
            ...dups.map((d) => d.leadId),
          ])
        ),
        duplicateDateAdds: Array.from(
          new Set([
            ...((canonical as any).duplicateDateAdds || []),
            ...dups
              .map((d) => d.dateAdded)
              .filter((d) => d && d !== canonical.dateAdded),
          ])
        ),
      };
      const maybeFill = (field: string, value: any) => {
        if ((canonical as any)[field]) return;
        if (value) patch[field] = value;
      };
      for (const dup of dups) {
        const fieldsToCheck = [
          "name",
          "email",
          "country",
          "source",
          "dateAdded",
          "firstCallDate",
          "firstCallStatus",
          "notes",
          "secondCallDate",
          "secondCallStatus",
          "secondCallNotes",
          "finalCallDate",
          "finalStatus",
          "finalNotes",
          "pronouns",
          "device",
          "leadScore",
          "lastUpdated",
          "lastMessageSnippet",
          "messageCount",
        ];
        for (const f of fieldsToCheck) maybeFill(f, (dup as any)[f]);
      }
      if (Object.keys(patch).length) {
        await ctx.db.patch(canonical._id, patch);
        merged++;
      }
      for (const dup of dups) {
        await ctx.db.delete(dup._id);
        removed++;
      }
      details.push({
        phone: canonical.phone,
        keptLeadId: canonical.leadId,
        mergedLeadIds: dups.map((d) => d.leadId),
      });
    }
    return { removed, merged, groupsProcessed: details.length, details };
  },
});

// One-time (idempotent) migration to assign an instanceId to legacy customer rows (those with undefined instanceId).
// Pass dryRun=true to preview counts without modifying data.
export const migrateLegacyCustomers = mutation({
  args: { instanceId: v.string(), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { instanceId, dryRun }) => {
    // Full scan (expected manageable size). If large, consider batching with pagination in future.
    const all = await ctx.db.query("customers").collect();
    const legacy = all.filter((c) => c.instanceId === undefined);
    if (dryRun) return { legacy: legacy.length, updated: 0, dryRun: true };
    let updated = 0;
    for (const doc of legacy) {
      await ctx.db.patch(doc._id, { instanceId });
      updated++;
    }
    return { legacy: legacy.length, updated, dryRun: false };
  },
});
