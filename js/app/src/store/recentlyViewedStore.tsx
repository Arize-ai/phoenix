import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type RecentlyViewedResourceType =
  | "project"
  | "dataset"
  | "experiment"
  | "prompt";

export interface RecentlyViewedResource {
  /**
   * The GraphQL GlobalID of the resource
   */
  id: string;
  type: RecentlyViewedResourceType;
  name: string;
  /**
   * The resource's user-authored description, when it has one. Persisted so
   * the search palette can show what a recently viewed resource is.
   */
  description?: string;
  /**
   * The app path that shows the resource
   */
  path: string;
}

export interface RecentlyViewedState {
  /**
   * Most recently viewed first
   */
  resources: RecentlyViewedResource[];
  recordResourceView: (resource: RecentlyViewedResource) => void;
}

const MAX_RECENTLY_VIEWED = 10;

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    devtools(
      (set) => ({
        resources: [],
        recordResourceView: (resource) => {
          set(
            (state) => {
              const mostRecent = state.resources[0];
              if (
                mostRecent?.id === resource.id &&
                mostRecent.name === resource.name &&
                mostRecent.description === resource.description
              ) {
                return state;
              }
              return {
                resources: [
                  resource,
                  ...state.resources.filter(
                    (existing) => existing.id !== resource.id
                  ),
                ].slice(0, MAX_RECENTLY_VIEWED),
              };
            },
            false,
            { type: "recordResourceView" }
          );
        },
      }),
      { name: "recentlyViewedStore" }
    ),
    { name: "arize-phoenix-recently-viewed" }
  )
);
