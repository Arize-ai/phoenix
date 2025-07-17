import { createContext, PropsWithChildren, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import {
  createProjectStore,
  CreateProjectStoreProps,
  ProjectState,
  ProjectStore,
} from "@phoenix/store/projectStore";

export const ProjectContext = createContext<ProjectStore | null>(null);

export function ProjectProvider({
  children,
  projectId,
}: PropsWithChildren<CreateProjectStoreProps>) {
  const [store] = useState<ProjectStore>(() =>
    createProjectStore({ projectId })
  );

  return (
    <ProjectContext.Provider value={store}>{children}</ProjectContext.Provider>
  );
}

export function useProjectContext<T>(
  selector: (state: ProjectState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(ProjectContext);
  if (!store) throw new Error("Missing ProjectContext.Provider in the tree");
  return useZustand(store.state, selector, equalityFn);
}
