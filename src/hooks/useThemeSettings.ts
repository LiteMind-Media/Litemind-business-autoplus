import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useThemeSettings() {
  const themeSettings = useQuery(api.theme.getTheme, {});
  const setTheme = useMutation(api.theme.setTheme);
  return { themeSettings, setTheme } as const;
}
