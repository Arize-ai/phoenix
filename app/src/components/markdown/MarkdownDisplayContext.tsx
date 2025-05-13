import {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
} from "react";

import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { MarkdownDisplayMode } from "./types";

export type MarkdownDisplayContextType = {
  mode: MarkdownDisplayMode;
  setMode: (mode: MarkdownDisplayMode) => void;
};

export const MarkdownDisplayContext =
  createContext<MarkdownDisplayContextType | null>(null);

export function useMarkdownMode(): MarkdownDisplayContextType {
  let context = useContext(MarkdownDisplayContext);
  if (context === null) {
    // eslint-disable-next-line no-console
    console.warn(
      "useMarkdownMode must be used within a MarkdownDisplayProvider"
    );
    context = { mode: "text", setMode: () => {} };
  }
  return context;
}

export function MarkdownDisplayProvider(props: PropsWithChildren) {
  const mode = usePreferencesContext((state) => {
    return state.markdownDisplayMode;
  });
  const setMarkdownDisplayMode = usePreferencesContext(
    (state) => state.setMarkdownDisplayMode
  );
  const setMode = useCallback(
    (mode: MarkdownDisplayMode) => {
      startTransition(() => {
        setMarkdownDisplayMode(mode);
      });
    },
    [setMarkdownDisplayMode]
  );

  return (
    <MarkdownDisplayContext.Provider value={{ mode, setMode }}>
      {props.children}
    </MarkdownDisplayContext.Provider>
  );
}
