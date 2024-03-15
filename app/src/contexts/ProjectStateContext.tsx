import React, {
  createContext,
  PropsWithChildren,
  startTransition,
  useCallback,
  useContext,
  useState,
} from "react";

export type ProjectStateContextType = {
  /**
   * The fetch key for the current data.
   * This acts as a unique identifier for the data.
   */
  fetchKey: number;
  /**
   * Creates a new fetchKey to force a refetch
   */
  updateFetchKey: () => void;
};

export const ProjectStateContext =
  createContext<ProjectStateContextType | null>(null);

export function useProjectState() {
  const context = useContext(ProjectStateContext);
  if (context === null) {
    throw new Error(
      "useProjectState must be used within a ProjectStateProvider"
    );
  }
  return context;
}

export function ProjectStateProvider({ children }: PropsWithChildren) {
  const [fetchKey, setFetchKey] = useState<number>(0);

  const updateFetchKey = useCallback(() => {
    startTransition(() => {
      setFetchKey((prev) => prev + 1);
    });
  }, [setFetchKey]);
  return (
    <ProjectStateContext.Provider value={{ fetchKey, updateFetchKey }}>
      {children}
    </ProjectStateContext.Provider>
  );
}
