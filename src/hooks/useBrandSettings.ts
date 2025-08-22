import { useQuery, useMutation } from 'convex/react';
import { Id } from '../..//convex/_generated/dataModel';

export interface BrandSettingsDoc { _id: Id<'brandSettings'>; name: string; logoUrl?: string; faviconUrl?: string; updatedAt: string; }

export function useBrandSettings() {
  const brand = useQuery('brand:getBrand', {});
  const mut = useMutation('brand:setBrand');
  return { brand, setBrand: mut } as const;
}
