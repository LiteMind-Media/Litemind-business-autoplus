// Deprecated: functionality moved inside useCustomers (remote-first + seeding).
// Keeping a lightweight wrapper for existing imports; returns remote list only.
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";

export function useRemoteCustomers() {
  const remote = useQuery(api.customers.list) || [];
  return { remote };
}
