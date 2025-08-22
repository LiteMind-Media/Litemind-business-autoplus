import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function useStatusColors() {
  const statusColors = useQuery(api.statusColors.getStatusColors, {});
  const setStatusColor = useMutation(api.statusColors.setStatusColor);
  return { statusColors, setStatusColor } as const;
}
