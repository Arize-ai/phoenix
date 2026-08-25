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
        schedulabilityStatus
        schedulabilityReason
        evaluator {
          kind
          description
        }
        traceProject {
          id
        }
        runSummary {
          status
        }
        ...ProjectEvaluatorStatsCard_projectEvaluator
        ...ProjectEvaluatorScopeDetails_projectEvaluator
        ...LLMProjectEvaluatorDetails_projectEvaluator
        ...CodeProjectEvaluatorDetails_projectEvaluator
        ...ProjectEvaluatorMetrics_projectEvaluator
        ...AnnotationConfigurationCard_projectEvaluator
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
  /** The evaluator's own trace project, or null when the evaluator was not found. */
  traceProjectId: string | null;
}> {
  const { projectEvaluatorId } = args.params;
  invariant(projectEvaluatorId, "projectEvaluatorId is required");

  let data: projectEvaluatorDetailsLoaderQuery["response"] | undefined;
  try {
    data = await fetchQuery<projectEvaluatorDetailsLoaderQuery>(
      RelayEnvironment,
      projectEvaluatorDetailsLoaderGQL,
      { projectEvaluatorId }
    ).toPromise();
  } catch {
    // The server rejects ids that don't name a live evaluator, so a malformed
    // or stale id surfaces here; fall through to the not-found state rather
    // than the route error boundary.
  }

  const node = data?.projectEvaluator;
  const projectEvaluator =
    node?.__typename === "ProjectEvaluator" ? node : null;

  return {
    queryRef: projectEvaluator
      ? loadQuery<projectEvaluatorDetailsLoaderQuery>(
          RelayEnvironment,
          projectEvaluatorDetailsLoaderGQL,
          { projectEvaluatorId }
        )
      : null,
    evaluatorDisplayName: projectEvaluator?.name ?? null,
    traceProjectId: projectEvaluator?.traceProject.id ?? null,
  };
}
