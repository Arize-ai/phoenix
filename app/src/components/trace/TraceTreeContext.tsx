import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { createContext, useContext, useState } from "react";

export type TraceTreeContextType = {
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <TraceTreeContext.Provider
      value={{ isCollapsed, setIsCollapsed, searchQuery, setSearchQuery }}
    >
      {props.children}
    </TraceTreeContext.Provider>
  );
}
