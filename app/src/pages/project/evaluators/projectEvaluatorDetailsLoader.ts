import { fetchQuery, graphql, loadQuery } from "react-relay";
import type { LoaderFunctionArgs } from "react-router";
import invariant from "tiny-invariant";

import RelayEnvironment from "@phoenix/RelayEnvironment";

import type { projectEvaluatorDetailsLoaderQuery } from "./__generated__/projectEvaluatorDetailsLoaderQuery.graphql";

export const projectEvaluatorDetailsLoaderGQL = graphql`
  query projectEvaluatorDetailsLoaderQuery($projectEvaluatorId: ID!) {
    projectEvaluator: node(id: $projectEvaluatorId) {
      __typename
      ... on ProjectEvaluator {
        id
        name
        enabled
        project {
          id
        }
        evaluator {
          __typename
          id
          kind
          name
          description
        }
        ...ProjectEvaluatorScopeDetails_projectEvaluator
        ...LLMProjectEvaluatorDetails_projectEvaluator
      }
    }
  }
`;

export type ProjectEvaluatorDetailsLoaderData = Awaited<
  ReturnType<typeof projectEvaluatorDetailsLoader>
>;

/**
 * Loads the data required for the project evaluator details page.
 *
 * The id in the URL may name a deleted evaluator or nothing at all, so a
 * failed or empty lookup resolves to a null query ref — the page renders a
 * not-found state — rather than rejecting into the route error boundary.
 */
export async function projectEvaluatorDetailsLoader(
  args: LoaderFunctionArgs
): Promise<{
  queryRef: ReturnType<
    typeof loadQuery<projectEvaluatorDetailsLoaderQuery>
  > | null;
  evaluatorDisplayName: string | null;
}> {
  const { projectEvaluatorId } = args.params;
  invariant(projectEvaluatorId, "projectEvaluatorId is required");

  let evaluatorDisplayName: string | null = null;
  let found = false;
  try {
    const data = await fetchQuery<projectEvaluatorDetailsLoaderQuery>(
      RelayEnvironment,
      projectEvaluatorDetailsLoaderGQL,
      { projectEvaluatorId }
    ).toPromise();
    if (data?.projectEvaluator?.__typename === "ProjectEvaluator") {
      found = true;
      evaluatorDisplayName = data.projectEvaluator.name;
    }
  } catch {
    // A malformed or stale id falls through to the not-found state.
  }

  const queryRef = found
    ? loadQuery<projectEvaluatorDetailsLoaderQuery>(
        RelayEnvironment,
        projectEvaluatorDetailsLoaderGQL,
        { projectEvaluatorId }
      )
    : null;

  return {
    queryRef,
    evaluatorDisplayName,
  };
}
