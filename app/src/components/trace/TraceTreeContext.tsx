import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

export type TraceTreeContextType = {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  searchQuery: string;
  setSearchQuery: (searchQuery: string) => void;
};

export const TraceTreeContext = createContext<TraceTreeContextType | null>(
  null
);

export function useTraceTree() {
  const context = useContext(TraceTreeContext);
  if (context === null) {
    throw new Error("useTraceTree must be used within a TraceTreeProvider");
  }
  return context;
}

export function TraceTreeProvider(props: PropsWithChildren) {
  const [isCollapsed, setIsCollapsedState] = useState(false);
  const [searchQuery, setSearchQueryState] = useState("");

  const setIsCollapsed = (isCollapsed: boolean) => {
    startTransition(() => {
      setIsCollapsedState(isCollapsed);
    });
  };

  const setSearchQuery = (searchQuery: string) => {
    startTransition(() => {
      setSearchQueryState(searchQuery.trim());
    });
  };

  return (
    <TraceTreeContext.Provider
      value={{ isCollapsed, setIsCollapsed, searchQuery, setSearchQuery }}
    >
      {props.children}
    </TraceTreeContext.Provider>
  );
}
