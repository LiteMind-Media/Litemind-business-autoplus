// Deprecated: functionality moved inside useCustomers (remote-first + seeding).
// Keeping a lightweight wrapper for existing imports; returns remote list only.
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";

// Lightweight legacy wrapper. Prefer useCustomers which handles local caching & sync.
export function useRemoteCustomers(instanceId?: string) {
  // Convex query now expects an args object (instanceId optional). Supply {} when undefined.
  const remote =
    useQuery(api.customers.list, instanceId ? { instanceId } : {}) || [];
  return { remote };
}
