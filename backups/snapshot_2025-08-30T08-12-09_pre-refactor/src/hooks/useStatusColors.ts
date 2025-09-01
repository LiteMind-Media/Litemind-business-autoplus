import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useStatusColors(instanceId?: string) {
  const statusColors = useQuery(api.statusColors.getStatusColors, {
    instanceId,
  });
  const rawSet = useMutation(api.statusColors.setStatusColor);
  const setStatusColor = (args: Parameters<typeof rawSet>[0]) =>
    rawSet({ instanceId, ...args });
  return { statusColors, setStatusColor } as const;
}
