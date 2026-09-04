import { useMemo } from "react";

type ModifierKey = "Cmd" | "Ctrl";
export function useModifierKey(): ModifierKey {
  return useMemo(() => {
    return window.navigator.userAgent.toLowerCase().includes("mac")
      ? "Cmd"
      : "Ctrl";
  }, []);
}
