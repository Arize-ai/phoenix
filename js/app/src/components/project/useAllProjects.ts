import { graphql, useLazyLoadQuery } from "react-relay";

import type { useAllProjectsQuery } from "./__generated__/useAllProjectsQuery.graphql";
import type { ProjectSelectionMenuProject } from "./ProjectSelectionMenu";

/**
 * Loads the full project list with the fields project pickers need
 * (see `ProjectSelectionMenu`). Suspends while loading — wrap the
 * consumer in a `Suspense` boundary.
 */
export function useAllProjects(): readonly ProjectSelectionMenuProject[] {
  const data = useLazyLoadQuery<useAllProjectsQuery>(
    graphql`
      query useAllProjectsQuery {
        projects(first: 1000) {
          edges {
            node {
              id
              name
              gradientStartColor
              gradientEndColor
            }
          }
        }
      }
    `,
    {}
  );
  return data.projects.edges.map((edge) => edge.node);
}
