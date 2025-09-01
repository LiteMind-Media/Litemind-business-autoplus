import { useCallback, useEffect, useState } from "react";
import { InstanceMeta, loadInstances, saveInstances } from "../types/instance";
import { v4 as uuid } from "uuid";

export function useInstances() {
  const [instances, setInstances] = useState<InstanceMeta[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const list = loadInstances();
    // Seed with Parlay Pros instance if empty
    if (list.length === 0) {
      const now = new Date().toISOString();
      const seed: InstanceMeta = {
        id: uuid(),
        name: "Parlay Pros",
        slug: "parlay-pros",
        createdAt: now,
        updatedAt: now,
      };
      setInstances([seed]);
      saveInstances([seed]);
      setLoaded(true);
    } else {
      setInstances(list);
      setLoaded(true);
    }
  }, []);

  const persist = useCallback((next: InstanceMeta[]) => {
    setInstances(next);
    saveInstances(next);
  }, []);

  const createInstance = useCallback(
    (partial: {
      name: string;
      slug?: string;
      customDomain?: string;
      subdomain?: string;
      color?: string;
    }) => {
      const now = new Date().toISOString();
      const slug = (partial.slug || partial.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      if (instances.some((i) => i.slug === slug)) {
        throw new Error("Slug already exists");
      }
      const meta: InstanceMeta = {
        id: uuid(),
        name: partial.name,
        slug,
        createdAt: now,
        updatedAt: now,
        customDomain: partial.customDomain,
        subdomain: partial.subdomain,
        color: partial.color,
      };
      const next = [...instances, meta];
      persist(next);
      return meta;
    },
    [instances, persist]
  );

  const updateInstance = useCallback(
    (id: string, patch: Partial<InstanceMeta>) => {
      const next = instances.map((i) =>
        i.id === id
          ? { ...i, ...patch, updatedAt: new Date().toISOString() }
          : i
      );
      persist(next);
    },
    [instances, persist]
  );

  const removeInstance = useCallback(
    (id: string) => {
      const next = instances.filter((i) => i.id !== id);
      persist(next);
    },
    [instances, persist]
  );

  return { instances, loaded, createInstance, updateInstance, removeInstance };
}
