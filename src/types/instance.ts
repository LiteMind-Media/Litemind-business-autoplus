export interface InstanceMeta {
  id: string; // stable UUID or slug
  name: string; // display name
  slug: string; // route segment (e.g. parlay-pros)
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  customerCount?: number; // cached quick metric
  customDomain?: string; // full custom domain (e.g. example.com)
  subdomain?: string; // subdomain portion if using *.yourplatform.com
  color?: string; // optional accent override
  archived?: boolean;
}

export interface InstanceRegistryState {
  instances: InstanceMeta[];
  loaded: boolean;
}

export const INSTANCE_REGISTRY_KEY = "ba_plus_instances_v1";

export function loadInstances(): InstanceMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INSTANCE_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as InstanceMeta[];
    return [];
  } catch (e) {
    console.warn("Failed to parse instances", e);
    return [];
  }
}

export function saveInstances(list: InstanceMeta[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INSTANCE_REGISTRY_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("Failed to save instances", e);
  }
}
