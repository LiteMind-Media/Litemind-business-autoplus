import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useThemeSettings(instanceId?: string) {
  const themeSettings = useQuery(api.theme.getTheme, { instanceId });
  const rawSetTheme = useMutation(api.theme.setTheme);
  const setTheme = (args: Parameters<typeof rawSetTheme>[0]) =>
    rawSetTheme({ instanceId, ...args });
  return { themeSettings, setTheme } as const;
}
