import { fetchQuery, graphql } from "react-relay";
import type { Environment } from "relay-runtime";

import type { evaluatorPlaygroundProjectLookupQuery } from "./__generated__/evaluatorPlaygroundProjectLookupQuery.graphql";

/**
 * Resolves a project name to its Relay node ID for `configure`, so an agent
 * that knows the project only by name need not query GraphQL first. The
 * server's name filter is a substring match, so the exact name is picked out
 * of the candidates here.
 */
export async function fetchProjectIdByName(
  environment: Environment,
  name: string
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const data = await fetchQuery<evaluatorPlaygroundProjectLookupQuery>(
    environment,
    graphql`
      query evaluatorPlaygroundProjectLookupQuery($filter: ProjectFilter!) {
        projects(first: 50, filter: $filter) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `,
    { filter: { col: "name", value: name } }
  ).toPromise();
  const candidates = (data?.projects.edges ?? []).map(({ node }) => node);
  const exact = candidates.find((candidate) => candidate.name === name);

  if (exact) return { ok: true, projectId: exact.id };
  const suggestions = candidates.map((candidate) => candidate.name);

  return {
    ok: false,
    error: suggestions.length
      ? `No project is named exactly "${name}". Similar names: ${suggestions.join(", ")}.`
      : `No project is named "${name}".`,
  };
}
