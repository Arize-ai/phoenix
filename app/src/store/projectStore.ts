import { create, StoreApi } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { ProjectTab } from "@phoenix/pages/project/constants";

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
      })),
      {
        name: makeProjectStoreKey(projectId),
      }
    )
  );

  return { state };
}
