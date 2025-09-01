import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import Papa from "papaparse";
import { Customer } from "@/types/customer";

// Namespaced storage key helper per instance
// (Removed unused ns helper)

interface UseCustomersOptions {
  instance: string; // slug for namespacing
  csvPath?: string; // default /customer-data.csv
}

interface HistoryEntry {
  customers: Customer[];
  ts: number;
}

export function useCustomers({
  instance,
  csvPath = "/customer-data.csv",
}: UseCustomersOptions) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  // Convex remote data & mutations
  // Using string paths because generated api types not yet updated to include customers module
  const remoteCustomers = useQuery(api.customers.list, {
    instanceId: instance,
  }); // args object passed as second param
  const bulkUpsertMutation = useMutation(api.customers.bulkUpsert);
  const removeMutation = useMutation(api.customers.remove);
  const dedupePhonesMutation = useMutation(
    api.customers.dedupePhones as unknown as typeof api.customers.dedupePhones
  );
  const purgeUnknownMutation = useMutation(
    api.customers.purgeUnknown as unknown as typeof api.customers.purgeUnknown
  );
  const purgedUnknownRef = useRef(false);
  const autoDedupedRef = useRef(false);
  const seededRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);

  // Migration: fix year 2000 dates -> 2025 while preserving month/day
  const normalizeYear = useCallback(
    (dateStr: string | undefined): string | undefined => {
      if (!dateStr) return dateStr;
      // Only transform exact 2000-MM-DD (ISO short) patterns
      const m = dateStr.match(/^2000-(\d{2}-\d{2})$/);
      if (m) return `2025-${m[1]}`;
      return dateStr;
    },
    []
  );

  // Normalize source strings (trim, case-insensitive, map aliases)
  const normalizeSource = useCallback(
    (raw: string | undefined): Customer["source"] => {
      if (!raw) return "";
      const v = raw.trim().toLowerCase();
      if (!v) return "";
      if (v === "ig" || v.startsWith("insta")) return "Instagram";
      if (v === "fb" || v.includes("facebook")) return "Facebook";
      if (v === "tt" || v.includes("tiktok")) return "TikTok";
      if (v === "wa" || v.includes("whatsapp")) return "WhatsApp";
      if (v.includes("web")) return "Web Form";
      // Exact matches to canonical values
      const canon = [
        "Instagram",
        "Facebook",
        "TikTok",
        "WhatsApp",
        "Web Form",
      ] as const;
      const direct = canon.find((c) => c.toLowerCase() === v);
      return direct || "";
    },
    []
  );

  const migrateDates = useCallback(
    (list: Customer[]) => {
      let changed = false;
      const monthMap: Record<string, string> = {
        january: "01",
        february: "02",
        march: "03",
        april: "04",
        may: "05",
        june: "06",
        july: "07",
        august: "08",
        september: "09",
        october: "10",
        november: "11",
        december: "12",
      };
      const toISO2025 = (raw?: string) => {
        if (!raw) return raw;
        // Already ISO 2025 (or other year) -> if year is 2000 change to 2025
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) {
          return iso[1] === "2000" ? `2025-${iso[2]}-${iso[3]}` : raw;
        }
        // Patterns like 'August 6' or 'Aug 6'
        const parts = raw.trim().split(/\s+/);
        if (parts.length === 2) {
          const mRaw = parts[0].toLowerCase();
          const dRaw = parts[1].replace(/[^0-9]/g, "");
          if (mRaw && dRaw) {
            // Allow short month names
            const full = Object.keys(monthMap).find((k) => k.startsWith(mRaw));
            if (full) {
              const mm = monthMap[full];
              const dd = dRaw.padStart(2, "0");
              return `2025-${mm}-${dd}`;
            }
          }
        }
        return raw; // leave as-is if unrecognized
      };
      const next = list.map((c) => {
        const patched = {
          ...c,
          dateAdded: toISO2025(normalizeYear(c.dateAdded)),
          firstCallDate: toISO2025(normalizeYear(c.firstCallDate)),
          secondCallDate: toISO2025(normalizeYear(c.secondCallDate)),
          finalCallDate: toISO2025(normalizeYear(c.finalCallDate)),
          source: normalizeSource(c.source),
        } as Customer;
        if (
          !changed &&
          (patched.dateAdded !== c.dateAdded ||
            patched.firstCallDate !== c.firstCallDate ||
            patched.secondCallDate !== c.secondCallDate ||
            patched.finalCallDate !== c.finalCallDate ||
            patched.source !== c.source)
        )
          changed = true;
        return patched;
      });
      return { data: next, changed } as const;
    },
    [normalizeYear, normalizeSource]
  );

  // Helper to push history
  const pushHistory = useCallback((prev: Customer[]) => {
    undoStack.current.push({ customers: prev, ts: Date.now() });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  // Local persistence disabled (Convex is source of truth); stub functions
  const persist = useCallback((_next: Customer[]) => {
    void _next;
  }, []); // placeholder persistence (Convex primary source)

  // Convex-first load.
  // Behavior change: ONLY seed from CSV assets when remote (Convex) is empty.
  // No repeated CSV fetch on subsequent renders once remote has data.
  // Auto phone dedupe is performed only at:
  //   1) Initial seed (remote empty)
  //   2) Explicit add/import operations (handled where mutations occur)
  // Removed previous unconditional dedupe on every remote adoption.
  useEffect(() => {
    if (remoteCustomers === undefined) return; // still loading
    // If remote has data adopt it (no seeding, no auto-dedupe here)
    if (remoteCustomers.length > 0) {
      type RemoteCustomer = { [K in keyof Customer]?: unknown } & {
        leadId: string;
      };
      const adopted: Customer[] = (remoteCustomers as RemoteCustomer[]).map(
        (r: RemoteCustomer) => ({
          id: r.leadId,
          name: (r.name as string) || "",
          phone: (r.phone as string) || "",
          email: (r.email as string) || undefined,
          country: (r.country as string) || undefined,
          source: normalizeSource(r.source as Customer["source"]),
          dateAdded: (r.dateAdded as string) || "",
          firstCallDate: (r.firstCallDate as string) || "",
          firstCallStatus:
            (r.firstCallStatus as Customer["firstCallStatus"]) || "",
          notes: (r.notes as string) || "",
          secondCallDate: (r.secondCallDate as string) || "",
          secondCallStatus:
            (r.secondCallStatus as Customer["secondCallStatus"]) || "",
          secondCallNotes: (r.secondCallNotes as string) || "",
          finalCallDate: (r.finalCallDate as string) || "",
          finalStatus: (r.finalStatus as Customer["finalStatus"]) || "",
          finalNotes: (r.finalNotes as string) || "",
          pronouns: (r.pronouns as string) || undefined,
          device: (r.device as string) || undefined,
          leadScore: (r.leadScore as number) || undefined,
          lastUpdated: (r.lastUpdated as string) || undefined,
          lastMessageSnippet: (r.lastMessageSnippet as string) || undefined,
          messageCount: (r.messageCount as number) || undefined,
        })
      );
      // Clean phone/email if phone contains '@'
      const cleaned = adopted.map((c) => {
        if (c.phone && /@/.test(c.phone)) {
          const parts = c.phone.split(/\||,/).map((p) => p.trim());
          const email = c.email || parts.find((p) => /@/.test(p));
          const phoneCandidate = parts.find(
            (p) => /\d/.test(p) && !/@/.test(p)
          );
          return { ...c, phone: phoneCandidate || "", email };
        }
        return c;
      });
      const { data: migrated } = migrateDates(cleaned);
      setCustomers(migrated);
      setLoaded(true);
      // One-time purge of unknown leads (no name/phone/email) – runs in background
      if (!purgedUnknownRef.current) {
        purgedUnknownRef.current = true;
        purgeUnknownMutation({ instanceId: instance }).catch(() => {});
      }
      // Do not auto-dedupe here; remote is assumed authoritative already.
      return;
    }
    // Seed once if remote empty
    if (seededRef.current) return;
    seededRef.current = true;
    (async () => {
      try {
        const res = await fetch(csvPath);
        const text = await res.text();
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as Record<string, unknown>[];
            const asStr = (v: unknown) => (v ?? "").toString();
            const base: Customer[] = data.map((row, idx) => {
              const contactRaw = asStr(row["Contact Info"]);
              let phone = contactRaw;
              let email: string | undefined;
              if (contactRaw.includes("|")) {
                const parts = contactRaw.split("|").map((p) => p.trim());
                parts.forEach((p) => {
                  if (!email && /@/.test(p)) email = p;
                });
                const phoneCandidate = parts.find(
                  (p) => /\d/.test(p) && !/@/.test(p)
                );
                phone = phoneCandidate
                  ? phoneCandidate.replace(/\s+/g, " ")
                  : "";
              } else if (/@/.test(contactRaw)) {
                email = contactRaw.trim();
                phone = "";
              }
              // Default Instagram if missing (base CSV known Instagram per user)
              const rawSource = asStr(
                row["Source (Facebook/Instagram/WhatsApp/TikTok)"]
              );
              const normalizedSource =
                normalizeSource(rawSource) || "Instagram";
              return {
                id: asStr(row["Lead ID"]) || String(idx + 1),
                name: asStr(row["Customer Name"]),
                phone,
                email,
                source: normalizedSource,
                dateAdded: asStr(row["Date Entered"]),
                firstCallDate: asStr(row["Date First Called"]),
                firstCallStatus: asStr(
                  row[
                    "First Call Status (Voicemail/Answered/Interested/Not Interested)"
                  ]
                ) as Customer["firstCallStatus"],
                notes: asStr(row["Notes from First Call"]),
                secondCallDate: asStr(row["Date Second Call"]),
                secondCallStatus: asStr(
                  row[
                    "Second Call Status (They Called/We Called/Voicemail/Answered)"
                  ]
                ) as Customer["secondCallStatus"],
                secondCallNotes: asStr(row["Notes from Second Call"]),
                finalCallDate: asStr(row["Date Registered"]),
                finalStatus: asStr(
                  row[
                    "Final Status (Registered/Not Registered/Follow-up Needed)"
                  ]
                ) as Customer["finalStatus"],
                finalNotes: asStr(row["Final Notes"]),
                lastUpdated: undefined,
              } as Customer;
            });
            // Optionally ingest latest Instagram leads CSV (new third file)
            const latestCsvPromise = fetch(
              "/latest_instagram_leads_template_import.csv"
            )
              .then((r) => (r.ok ? r.text() : Promise.reject()))
              .then(
                (txt) =>
                  new Promise<Record<string, unknown>[]>((resolve) =>
                    Papa.parse<Record<string, unknown>>(txt, {
                      header: true,
                      skipEmptyLines: true,
                      complete: (r) => resolve(r.data),
                    })
                  )
              )
              .catch(() => [] as Record<string, unknown>[]);
            // WhatsApp auto ingest (simplified: only phone + date)
            Promise.all([
              latestCsvPromise,
              fetch("/whatsapp-customer-data.csv"),
            ])
              .then(async ([latestRows, waResp]) => {
                // Map latest Instagram rows into Customer objects
                const latest: Customer[] = latestRows.map((row, idxL) => {
                  const contactRaw = asStr(row["Contact Info"]);
                  let phone = contactRaw;
                  let email: string | undefined;
                  if (contactRaw && contactRaw.includes("|")) {
                    const parts = contactRaw.split("|").map((p) => p.trim());
                    parts.forEach((p) => {
                      if (!email && /@/.test(p)) email = p;
                    });
                    const phoneCandidate = parts.find(
                      (p) => /\d/.test(p) && !/@/.test(p)
                    );
                    phone = phoneCandidate
                      ? phoneCandidate.replace(/\s+/g, " ")
                      : "";
                  } else if (/@/.test(contactRaw)) {
                    email = contactRaw.trim();
                    phone = "";
                  }
                  const rawSource = asStr(
                    row["Source (Facebook/Instagram/WhatsApp/TikTok)"]
                  );
                  const normalizedSource =
                    normalizeSource(rawSource) || "Instagram";
                  return {
                    id: asStr(row["Lead ID"]) || `latest_${idxL}_${Date.now()}`,
                    name: asStr(row["Customer Name"]),
                    phone,
                    email,
                    source: normalizedSource,
                    dateAdded: asStr(row["Date Entered"]),
                    firstCallDate: asStr(row["Date First Called"]),
                    firstCallStatus: asStr(
                      row[
                        "First Call Status (Voicemail/Answered/Interested/Not Interested)"
                      ]
                    ) as Customer["firstCallStatus"],
                    notes: asStr(row["Notes from First Call"]),
                    secondCallDate: asStr(row["Date Second Call"]),
                    secondCallStatus: asStr(
                      row[
                        "Second Call Status (They Called/We Called/Voicemail/Answered)"
                      ]
                    ) as Customer["secondCallStatus"],
                    secondCallNotes: asStr(row["Notes from Second Call"]),
                    finalCallDate: asStr(row["Date Registered"]),
                    finalStatus: asStr(
                      row[
                        "Final Status (Registered/Not Registered/Follow-up Needed)"
                      ]
                    ) as Customer["finalStatus"],
                    finalNotes: asStr(row["Final Notes"]),
                    lastUpdated: undefined,
                    pronouns: undefined,
                    device: undefined,
                    leadScore: undefined,
                    lastMessageSnippet: undefined,
                    messageCount: undefined,
                  } as Customer;
                });
                const waText = await (waResp.ok ? waResp.text() : "");
                // Parse WhatsApp rows here directly
                let waRows: Record<string, unknown>[] = [];
                if (waText) {
                  await new Promise<void>((resolve) => {
                    Papa.parse<Record<string, unknown>>(waText, {
                      header: true,
                      skipEmptyLines: true,
                      complete: (r) => {
                        waRows = r.data;
                        resolve();
                      },
                    });
                  });
                }
                const WA: Customer[] = waRows.map((r, idx2) => {
                  const p = asStr(r["Phone Number"]).trim();
                  const lu = asStr(r["Last Updated"]);
                  let dateAdded = "";
                  const m = lu.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                  if (m) {
                    const dd = m[1].padStart(2, "0");
                    const mm = m[2].padStart(2, "0");
                    dateAdded = `${m[3]}-${mm}-${dd}`;
                  }
                  return {
                    id: `wa_${idx2}_${p}`,
                    name: "",
                    phone: p,
                    email: undefined,
                    source: "WhatsApp",
                    dateAdded,
                    firstCallDate: "",
                    firstCallStatus: "",
                    notes: "",
                    secondCallDate: "",
                    secondCallStatus: "",
                    secondCallNotes: "",
                    finalCallDate: "",
                    finalStatus: "",
                    finalNotes: "",
                    lastUpdated: undefined,
                  } as Customer;
                });
                const existingPhones = new Set(base.map((c) => c.phone));
                const merged = [
                  ...base,
                  ...latest,
                  ...WA.filter((c) => c.phone && !existingPhones.has(c.phone)),
                ];
                const { data: migrated } = migrateDates(merged);
                const ensured = migrated.map((c) => {
                  // Ensure dateAdded fallback to avoid 'Unknown' grouping
                  if (
                    !c.dateAdded ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(c.dateAdded)
                  ) {
                    const fallback =
                      c.firstCallDate ||
                      c.secondCallDate ||
                      c.finalCallDate ||
                      new Date().toISOString().slice(0, 10);
                    c.dateAdded = fallback;
                  }
                  return c;
                });
                setCustomers(ensured);
                bulkUpsertMutation({
                  instanceId: instance,
                  customers: ensured.map((d) => ({
                    leadId: d.id,
                    name: d.name,
                    phone: d.phone,
                    email: d.email,
                    country: d.country,
                    source: d.source,
                    dateAdded: d.dateAdded,
                    firstCallDate: d.firstCallDate,
                    firstCallStatus: d.firstCallStatus,
                    notes: d.notes,
                    secondCallDate: d.secondCallDate,
                    secondCallStatus: d.secondCallStatus,
                    secondCallNotes: d.secondCallNotes,
                    finalCallDate: d.finalCallDate,
                    finalStatus: d.finalStatus,
                    finalNotes: d.finalNotes,
                    pronouns: d.pronouns,
                    device: d.device,
                    leadScore: d.leadScore,
                    lastUpdated: d.lastUpdated,
                    lastMessageSnippet: d.lastMessageSnippet,
                    messageCount: d.messageCount,
                  })),
                }).catch(() => {});
                setLoaded(true);
                // One-time dedupe after initial seed
                if (!autoDedupedRef.current) {
                  autoDedupedRef.current = true;
                  dedupePhonesMutation({ instanceId: instance }).catch(
                    () => {}
                  );
                }
              })
              .catch(() => {
                const { data: migrated } = migrateDates(base);
                const ensured = migrated.map((c) => {
                  if (
                    !c.dateAdded ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(c.dateAdded)
                  ) {
                    const fallback =
                      c.firstCallDate ||
                      c.secondCallDate ||
                      c.finalCallDate ||
                      new Date().toISOString().slice(0, 10);
                    c.dateAdded = fallback;
                  }
                  return c;
                });
                setCustomers(ensured);
                bulkUpsertMutation({
                  instanceId: instance,
                  customers: ensured.map((d) => ({
                    leadId: d.id,
                    name: d.name,
                    phone: d.phone,
                    email: d.email,
                    country: d.country,
                    source: d.source,
                    dateAdded: d.dateAdded,
                    firstCallDate: d.firstCallDate,
                    firstCallStatus: d.firstCallStatus,
                    notes: d.notes,
                    secondCallDate: d.secondCallDate,
                    secondCallStatus: d.secondCallStatus,
                    secondCallNotes: d.secondCallNotes,
                    finalCallDate: d.finalCallDate,
                    finalStatus: d.finalStatus,
                    finalNotes: d.finalNotes,
                    pronouns: d.pronouns,
                    device: d.device,
                    leadScore: d.leadScore,
                    lastUpdated: d.lastUpdated,
                    lastMessageSnippet: d.lastMessageSnippet,
                    messageCount: d.messageCount,
                  })),
                }).catch(() => {});
                setLoaded(true);
                if (!autoDedupedRef.current) {
                  autoDedupedRef.current = true;
                  dedupePhonesMutation({ instanceId: instance }).catch(
                    () => {}
                  );
                }
              });
          },
        });
      } catch (e) {
        console.error("Seed failed", e);
        setLoaded(true);
      }
    })();
  }, [
    remoteCustomers,
    csvPath,
    migrateDates,
    normalizeSource,
    bulkUpsertMutation,
    dedupePhonesMutation,
    purgeUnknownMutation,
    instance,
  ]);

  const updateCustomer = useCallback(
    (id: string, patch: Partial<Customer>) => {
      setCustomers((prev) => {
        const before = prev;
        const next = prev.map((c) =>
          c.id === id
            ? { ...c, ...patch, lastUpdated: new Date().toISOString() }
            : c
        );
        pushHistory(before);
        persist(next);
        // Remote sync (single record upsert)
        try {
          const target = next.find((c) => c.id === id);
          if (target) {
            bulkUpsertMutation({
              instanceId: instance,
              customers: [
                {
                  leadId: target.id,
                  name: target.name,
                  phone: target.phone,
                  email: target.email,
                  country: target.country,
                  source: target.source,
                  dateAdded: target.dateAdded,
                  firstCallDate: target.firstCallDate,
                  firstCallStatus: target.firstCallStatus,
                  notes: target.notes,
                  secondCallDate: target.secondCallDate,
                  secondCallStatus: target.secondCallStatus,
                  secondCallNotes: target.secondCallNotes,
                  finalCallDate: target.finalCallDate,
                  finalStatus: target.finalStatus,
                  finalNotes: target.finalNotes,
                  pronouns: target.pronouns,
                  device: target.device,
                  leadScore: target.leadScore,
                  lastUpdated: target.lastUpdated,
                  lastMessageSnippet: target.lastMessageSnippet,
                  messageCount: target.messageCount,
                },
              ],
            }).catch(() => {});
          }
        } catch {}
        return next;
      });
    },
    [persist, pushHistory, bulkUpsertMutation, instance]
  );

  const bulkUpdate = useCallback(
    (ids: string[], patch: Partial<Customer>) => {
      setCustomers((prev) => {
        const before = prev;
        const setIds = new Set(ids);
        const next = prev.map((c) =>
          setIds.has(c.id)
            ? { ...c, ...patch, lastUpdated: new Date().toISOString() }
            : c
        );
        pushHistory(before);
        persist(next);
        return next;
      });
    },
    [persist, pushHistory]
  );

  const addCustomer = useCallback(
    (cust: Omit<Customer, "id"> & { id?: string }) => {
      setCustomers((prev) => {
        const before = prev;
        const id = cust.id || crypto.randomUUID();
        const next = [
          ...prev,
          { ...cust, id, lastUpdated: new Date().toISOString() } as Customer,
        ];
        pushHistory(before);
        persist(next);
        try {
          const created = next.find((c) => c.id === id);
          if (created) {
            bulkUpsertMutation({
              instanceId: instance,
              customers: [
                {
                  leadId: created.id,
                  name: created.name,
                  phone: created.phone,
                  email: created.email,
                  country: created.country,
                  source: created.source,
                  dateAdded: created.dateAdded,
                  firstCallDate: created.firstCallDate,
                  firstCallStatus: created.firstCallStatus,
                  notes: created.notes,
                  secondCallDate: created.secondCallDate,
                  secondCallStatus: created.secondCallStatus,
                  secondCallNotes: created.secondCallNotes,
                  finalCallDate: created.finalCallDate,
                  finalStatus: created.finalStatus,
                  finalNotes: created.finalNotes,
                  pronouns: created.pronouns,
                  device: created.device,
                  leadScore: created.leadScore,
                  lastUpdated: created.lastUpdated,
                  lastMessageSnippet: created.lastMessageSnippet,
                  messageCount: created.messageCount,
                },
              ],
            }).catch(() => {});
          }
        } catch {}
        return next;
      });
    },
    [persist, pushHistory, bulkUpsertMutation]
  );

  const removeCustomer = useCallback(
    (id: string) => {
      setCustomers((prev) => {
        const before = prev;
        const next = prev.filter((c) => c.id !== id);
        pushHistory(before);
        persist(next);
        try {
          removeMutation({ leadId: id, instanceId: instance }).catch(() => {});
        } catch {}
        return next;
      });
    },
    [persist, pushHistory, removeMutation]
  );

  const undo = useCallback(() => {
    const last = undoStack.current.pop();
    if (!last) return;
    redoStack.current.push({ customers, ts: Date.now() });
    setCustomers(last.customers);
    persist(last.customers);
  }, [customers, persist]);

  const redo = useCallback(() => {
    const last = redoStack.current.pop();
    if (!last) return;
    undoStack.current.push({ customers, ts: Date.now() });
    setCustomers(last.customers);
    persist(last.customers);
  }, [customers, persist]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const metrics = useMemo(() => {
    // Prefer authoritative remote count if available (ensures analytics matches Convex DB)
    const remoteTotal = Array.isArray(remoteCustomers)
      ? remoteCustomers.length
      : undefined;
    const registered = customers.filter(
      (c) => c.finalStatus === "Registered"
    ).length;
    // Use the larger of local vs remote while sync may be lagging, so UI reflects imported rows immediately.
    const total =
      remoteTotal !== undefined
        ? Math.max(remoteTotal, customers.length)
        : customers.length;
    return { total, registered };
  }, [customers, remoteCustomers]);

  // Diagnostic counts (help explain discrepancies)
  const remoteCount = Array.isArray(remoteCustomers)
    ? remoteCustomers.length
    : undefined;
  const uniquePhoneCount = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => set.add((c.phone && c.phone.trim()) || c.id));
    return set.size;
  }, [customers]);

  // Auto-sync: if local has customers missing in remote (e.g., after CSV import) push the diff.
  const autoSyncRef = useRef<string | false>(false);
  useEffect(() => {
    if (!Array.isArray(remoteCustomers)) return; // still loading
    if (customers.length === 0) return; // nothing local yet
    // Build remote id set (leadId)
    type RemoteCustomer = {
      id?: string;
      _id?: string;
      leadId?: string;
      phone?: string;
    } & Partial<Customer>;
    const remoteIds = new Set<string>(
      (remoteCustomers as RemoteCustomer[]).map(
        (r) => (r.leadId as string) || (r.id as string)
      )
    );
    const missing = customers.filter((c) => !remoteIds.has(c.id));
    if (missing.length === 0) return;
    // Avoid spamming: only attempt once per mismatch size snapshot
    const key = `${instance}:${remoteIds.size}->${customers.length}`;
    if (autoSyncRef.current === key) return;
    autoSyncRef.current = key;
    // Chunk to avoid oversized mutation payloads if very large
    const CHUNK = 100;
    (async () => {
      try {
        for (let i = 0; i < missing.length; i += CHUNK) {
          const slice = missing.slice(i, i + CHUNK);
          await bulkUpsertMutation({
            instanceId: instance,
            customers: slice.map((d) => ({
              leadId: d.id,
              name: d.name,
              phone: d.phone,
              email: d.email,
              country: d.country,
              source: d.source,
              dateAdded: d.dateAdded,
              firstCallDate: d.firstCallDate,
              firstCallStatus: d.firstCallStatus,
              notes: d.notes,
              secondCallDate: d.secondCallDate,
              secondCallStatus: d.secondCallStatus,
              secondCallNotes: d.secondCallNotes,
              finalCallDate: d.finalCallDate,
              finalStatus: d.finalStatus,
              finalNotes: d.finalNotes,
              pronouns: d.pronouns,
              device: d.device,
              leadScore: d.leadScore,
              lastUpdated: d.lastUpdated,
              lastMessageSnippet: d.lastMessageSnippet,
              messageCount: d.messageCount,
            })),
          }).catch((err) => {
            console.error("Auto-sync bulkUpsert failed", err);
            throw err; // break loop
          });
        }
        // Trigger dedupe after sync if remote had fewer
        if (missing.length > 0) {
          dedupePhonesMutation({ instanceId: instance }).catch(() => {});
        }
      } catch {
        // Allow retry on next render if more locals appear
        autoSyncRef.current = false;
      }
    })();
  }, [
    remoteCustomers,
    customers,
    bulkUpsertMutation,
    dedupePhonesMutation,
    instance,
  ]);

  // Manual force sync function (exposed)
  const forceSync = useCallback(async () => {
    if (!Array.isArray(remoteCustomers)) {
      return { added: 0, skipped: 0 };
    }
    const remoteIds = new Set<string>(
      (remoteCustomers as Array<Record<string, unknown>>).map(
        (r) => (r.leadId as string) || (r.id as string)
      )
    );
    const missing = customers.filter((c) => !remoteIds.has(c.id));
    if (missing.length === 0) return { added: 0, skipped: customers.length };
    const CHUNK = 100;
    let added = 0;
    for (let i = 0; i < missing.length; i += CHUNK) {
      const slice = missing.slice(i, i + CHUNK);
      await bulkUpsertMutation({
        instanceId: instance,
        customers: slice.map((d) => ({
          leadId: d.id,
          name: d.name,
          phone: d.phone,
          email: d.email,
          country: d.country,
          source: d.source,
          dateAdded: d.dateAdded,
          firstCallDate: d.firstCallDate,
          firstCallStatus: d.firstCallStatus,
          notes: d.notes,
          secondCallDate: d.secondCallDate,
          secondCallStatus: d.secondCallStatus,
          secondCallNotes: d.secondCallNotes,
          finalCallDate: d.finalCallDate,
          finalStatus: d.finalStatus,
          finalNotes: d.finalNotes,
          pronouns: d.pronouns,
          device: d.device,
          leadScore: d.leadScore,
          lastUpdated: d.lastUpdated,
          lastMessageSnippet: d.lastMessageSnippet,
          messageCount: d.messageCount,
        })),
      }).catch((err) => {
        console.error("Force sync failed", err);
        throw err;
      });
      added += slice.length;
    }
    dedupePhonesMutation({ instanceId: instance }).catch(() => {});
    return { added, skipped: customers.length - added };
  }, [remoteCustomers, customers, bulkUpsertMutation, dedupePhonesMutation]);

  // Integrity backfill disabled (removed) to prevent reintroduction of placeholder/empty leads from public CSV assets.

  // Expose a manual reseed (rarely needed) and on-demand dedupe for imports
  const manualReseedFromCsv = useCallback(async () => {
    if (remoteCustomers && remoteCustomers.length > 0) return; // safety: only when empty
    seededRef.current = false; // allow seeding logic to run again
  }, [remoteCustomers]);

  const runDedupe = useCallback(() => {
    return dedupePhonesMutation({ instanceId: instance }).catch(() => {});
  }, [dedupePhonesMutation, instance]);

  return {
    customers,
    loaded,
    updateCustomer,
    bulkUpdate,
    addCustomer,
    removeCustomer,
    dedupePhones: runDedupe,
    manualReseedFromCsv,
    undo,
    redo,
    canUndo,
    canRedo,
    metrics,
    forceSync,
    remoteCount,
    uniquePhoneCount,
  };
}
