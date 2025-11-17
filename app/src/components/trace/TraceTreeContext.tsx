import {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

export type TraceTreeContextType = {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
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
  const [isCollapsed, _setIsCollapsed] = useState<boolean>(false);
  const setIsCollapsed = useCallback((collapsed: boolean) => {
    startTransition(() => {
      _setIsCollapsed(collapsed);
    });
  }, []);

  return (
    <TraceTreeContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {props.children}
    </TraceTreeContext.Provider>
  );
}
