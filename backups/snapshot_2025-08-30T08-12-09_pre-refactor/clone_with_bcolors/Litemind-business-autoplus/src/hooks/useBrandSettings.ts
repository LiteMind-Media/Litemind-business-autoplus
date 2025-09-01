import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export interface BrandSettingsDoc {
  _id: Id<"brandSettings">;
  name: string;
  logoUrl?: string;
  faviconUrl?: string;
  updatedAt: string;
}

export function useBrandSettings() {
  const brand = useQuery(api.brand.getBrand, {});
  const mut = useMutation(api.brand.setBrand);
  return { brand, setBrand: mut } as const;
}
