import type { StoreApi } from "zustand";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { ProjectTab } from "@phoenix/pages/project/constants";

export interface ProjectState {
  defaultTab: ProjectTab;
  setDefaultTab: (tab: ProjectTab) => void;
  /**
   * Whether to treat orphan spans as roots.
   * @default false
   */
  treatOrphansAsRoots: boolean;
  /**
   * Set whether to treat orphan spans as roots.
   */
  setTreatOrphansAsRoots: (treatOrphansAsRoots: boolean) => void;
  /**
   * Whether to show the aside panel on the spans and traces tables.
   * @default true
   */
  showTableAside: boolean;
  /**
   * Set whether to show the aside panel on the spans and traces tables.
   */
  setShowTableAside: (showTableAside: boolean) => void;
}

export interface ProjectStore {
  state: StoreApi<ProjectState>;
}

const makeProjectStoreKey = (projectId: string) =>
  `arize-phoenix-project-${projectId}`;

export type CreateProjectStoreProps = {
  projectId: string;
};

export function createProjectStore({
  projectId,
}: CreateProjectStoreProps): ProjectStore {
  const state = create<ProjectState>()(
    persist(
      devtools((set) => ({
        defaultTab: "spans",
        setDefaultTab: (tab: ProjectTab) => {
          set({ defaultTab: tab }, false, { type: "setDefaultTab" });
        },
        treatOrphansAsRoots: false,
        setTreatOrphansAsRoots: (treatOrphansAsRoots: boolean) => {
          set({ treatOrphansAsRoots }, false, {
            type: "setTreatOrphansAsRoots",
          });
        },
        showTableAside: true,
        setShowTableAside: (showTableAside: boolean) => {
          set({ showTableAside }, false, {
            type: "setShowTableAside",
          });
        },
      })),
      {
        name: makeProjectStoreKey(projectId),
      }
    )
  );

  return { state };
}
