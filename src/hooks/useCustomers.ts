import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Customer } from "@/types/customer";

// Namespaced storage key helper per instance
function ns(instanceSlug: string, suffix: string) {
  return `${instanceSlug}__${suffix}`;
}

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
  const [loaded, setLoaded] = useState(false);
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);

  // Helper to push history
  const pushHistory = useCallback((prev: Customer[]) => {
    undoStack.current.push({ customers: prev, ts: Date.now() });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const persist = useCallback(
    (next: Customer[]) => {
      try {
        localStorage.setItem(
          ns(instance, "customers_v1"),
          JSON.stringify(next)
        );
      } catch {}
    },
    [instance]
  );

  const loadFromStorage = useCallback((): Customer[] | null => {
    try {
      const raw = localStorage.getItem(ns(instance, "customers_v1"));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Customer[];
    } catch {}
    return null;
  }, [instance]);

  // Initial load: storage else CSV
  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = loadFromStorage();
    if (existing) {
      setCustomers(existing);
      setLoaded(true);
      return;
    }
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
            const mapped: Customer[] = data.map((row, idx) => ({
              id: asStr(row["Lead ID"]) || String(idx + 1),
              name: asStr(row["Customer Name"]),
              phone: asStr(row["Contact Info"]),
              email: undefined,
              source: asStr(
                row["Source (Facebook/Instagram/WhatsApp/TikTok)"]
              ) as Customer["source"],
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
                row["Final Status (Registered/Not Registered/Follow-up Needed)"]
              ) as Customer["finalStatus"],
              finalNotes: asStr(row["Final Notes"]),
              lastUpdated: undefined,
            }));
            setCustomers(mapped);
            persist(mapped);
            setLoaded(true);
          },
        });
      } catch (e) {
        console.error("Failed to load CSV", e);
        setLoaded(true);
      }
    })();
  }, [csvPath, loadFromStorage, persist]);

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
        return next;
      });
    },
    [persist, pushHistory]
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
        return next;
      });
    },
    [persist, pushHistory]
  );

  const removeCustomer = useCallback(
    (id: string) => {
      setCustomers((prev) => {
        const before = prev;
        const next = prev.filter((c) => c.id !== id);
        pushHistory(before);
        persist(next);
        return next;
      });
    },
    [persist, pushHistory]
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
    const registered = customers.filter(
      (c) => c.finalStatus === "Registered"
    ).length;
    return { total: customers.length, registered };
  }, [customers]);

  return {
    customers,
    loaded,
    updateCustomer,
    bulkUpdate,
    addCustomer,
    removeCustomer,
    undo,
    redo,
    canUndo,
    canRedo,
    metrics,
  };
}
