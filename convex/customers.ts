import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
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
    // Strategy: prefetch existing rows to avoid O(n) queries causing timeouts for large imports.
    let skipped = 0;
    let collapsedDuplicateLeadIds = 0;
    const perRecordErrors: { leadId: string; error: string }[] = [];

    let existingDocs: any[];
    try {
      if (instanceId) {
        existingDocs = await ctx.db
          .query("customers")
          .withIndex("by_instance_leadId", (q) =>
            q.eq("instanceId", instanceId)
          )
          .collect();
      } else {
        existingDocs = await ctx.db.query("customers").collect();
      }
    } catch (e) {
      console.error("bulkUpsert prefetch failed", e);
      throw new Error(
        "bulkUpsert prefetch failed: " +
          (e instanceof Error ? e.message : String(e))
      );
    }
    // If very large batch, suggest chunking (defensive explicit error) - client will chunk after this change but keep guard.
    if (customers.length > 1500) {
      console.warn("bulkUpsert received very large batch", {
        size: customers.length,
      });
    }
    // Collapse duplicates in existing set first.
    const byLead: Record<string, any[]> = {};
    for (const doc of existingDocs) {
      (byLead[doc.leadId] ||= []).push(doc);
    }
    const existingMap: Record<string, any> = {};
    for (const leadId of Object.keys(byLead)) {
      const arr = byLead[leadId];
      if (arr.length === 1) {
        existingMap[leadId] = arr[0];
        continue;
      }
      arr.sort((a, b) => (a._creationTime || 0) - (b._creationTime || 0));
      existingMap[leadId] = arr[0];
      for (const dup of arr.slice(1)) {
        await ctx.db.delete(dup._id);
        collapsedDuplicateLeadIds++;
      }
    }

    for (const c of customers) {
      try {
        const normName = (c.name || "").trim().toLowerCase();
        const digits = (c.phone || "").replace(/\D+/g, "");
        const hasName = !!(
          normName &&
          normName !== "unknown" &&
          normName !== "unnamed"
        );
        const hasPhone = digits.length >= 5;
        const hasEmail = !!(c.email && c.email.trim().length > 0);
        if (!hasName && !hasPhone && !hasEmail) {
          skipped++;
          continue;
        }
        const existing = existingMap[c.leadId];
        if (existing) {
          // Patch existing (avoid patch storm by only updating changed fields could be future optimization)
          await ctx.db.patch(existing._id, {
            ...c,
            instanceId: instanceId || existing.instanceId,
          });
        } else {
          const insertedId = await ctx.db.insert("customers", {
            ...c,
            instanceId,
          });
          // Register in map to prevent duplicate inserts within same batch
          existingMap[c.leadId] = { _id: insertedId, ...c, instanceId } as any;
        }
      } catch (err) {
        perRecordErrors.push({ leadId: c.leadId, error: String(err) });
      }
    }
    const errors = perRecordErrors.slice(0, 25); // cap to avoid huge payloads
    const truncated = perRecordErrors.length > errors.length;
    return {
      count: customers.length,
      skipped,
      collapsedDuplicateLeadIds,
      errors,
      errorsTruncated: truncated,
    };
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

// Purge "unknown" leads: no meaningful name, no phone digits, and no email.
// Optional instance scoped.
export const purgeUnknown = mutation({
  args: { instanceId: v.optional(v.string()) },
  handler: async (ctx, { instanceId }) => {
    try {
      const docs = instanceId
        ? await ctx.db
            .query("customers")
            .withIndex("by_instance_leadId", (q) =>
              q.eq("instanceId", instanceId)
            )
            .collect()
        : await ctx.db.query("customers").collect();
      const toDelete: Id<"customers">[] = [];
      for (const c of docs) {
        // All fields required by schema except optional ones, but be defensive.
        const name = (c as any).name as string | undefined;
        const phone = (c as any).phone as string | undefined;
        const email = (c as any).email as string | undefined;
        const hasName = !!(
          name &&
          name.trim().length > 0 &&
          name.toLowerCase() !== "unknown" &&
          name.toLowerCase() !== "unnamed"
        );
        const digits = (phone || "").replace(/\D+/g, "");
        const hasPhone = digits.length >= 5; // heuristic threshold
        const hasEmail = !!(email && email.trim().length > 0);
        if (!hasName && !hasPhone && !hasEmail) {
          toDelete.push(c._id);
        }
      }
      for (const id of toDelete) {
        await ctx.db.delete(id);
      }
      return { scanned: docs.length, removed: toDelete.length };
    } catch (err) {
      console.error("purgeUnknown failed", err);
      throw err;
    }
  },
});
