import { createContext, useContext } from "react";

import type { PromptInputContextValue } from "./types";

export const PromptInputContext = createContext<PromptInputContextValue | null>(
  null
);

export function usePromptInputContext(): PromptInputContextValue {
  const context = useContext(PromptInputContext);
  if (!context) {
    throw new Error(
      "usePromptInputContext must be used within a <PromptInput> component"
    );
  }
  return context;
}
