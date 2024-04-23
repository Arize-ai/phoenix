import React, {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

import { MarkdownDisplayMode } from "./types";

export type MarkdownDisplayContextType = {
  mode: MarkdownDisplayMode;
  setMode: (theme: MarkdownDisplayMode) => void;
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

export function MarkdownDisplayProvider(
  props: PropsWithChildren<{ initialMode?: MarkdownDisplayMode }>
) {
  const [mode, _setMode] = useState<MarkdownDisplayMode>(
    props.initialMode || "text"
  );
  const setMode = useCallback((mode: MarkdownDisplayMode) => {
    startTransition(() => {
      _setMode(mode);
    });
  }, []);

  return (
    <MarkdownDisplayContext.Provider value={{ mode, setMode }}>
      {props.children}
    </MarkdownDisplayContext.Provider>
  );
}
