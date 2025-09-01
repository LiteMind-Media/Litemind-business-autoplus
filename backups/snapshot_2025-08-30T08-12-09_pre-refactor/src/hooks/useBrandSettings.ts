import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export interface BrandSettingsDoc {
  _id: Id<"brandSettings">;
  name: string;
  logoUrl?: string;
  faviconUrl?: string;
  updatedAt: string;
  colors?: {
    gradientFrom: string;
    gradientVia: string;
    gradientTo: string;
    background: string;
    cardBg: string;
    mutedBg: string;
    border: string;
    primaryText: string;
    secondaryText: string;
    sidebarText: string;
    headerText: string;
    mode?: string;
    backgroundRadialCenter?: string;
    backgroundRadialEdge?: string;
  };
  statusColorsSnapshot?: { key: string; color: string }[];
}

export function useBrandSettings(instanceId?: string) {
  const brand = useQuery(api.brand.getBrand, { instanceId });
  const mut = useMutation(api.brand.setBrand);
  const snapshot = useMutation(api.brand.snapshotBrandColors);
  const apply = useMutation(api.brand.applyBrandColors);
  return {
    brand,
    setBrand: (args: Parameters<typeof mut>[0]) => mut({ instanceId, ...args }),
    snapshotBrandColors: snapshot,
    applyBrandColors: apply,
  } as const;
}
