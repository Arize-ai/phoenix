import { createContext, useContext } from "react";

import type { PromptInputContextValue } from "./types";

export const PromptInputContext = createContext<PromptInputContextValue | null>(
  null
);

/**
 * Access the shared PromptInput context. Must be called from a descendant
 * of `<PromptInput>`. Useful when building custom sub-components that need
 * access to status, value, or submit behavior.
 */
export function usePromptInputContext(): PromptInputContextValue {
  const context = useContext(PromptInputContext);
  if (!context) {
    throw new Error(
      "usePromptInputContext must be used within a <PromptInput> component"
    );
  }
  return context;
}
