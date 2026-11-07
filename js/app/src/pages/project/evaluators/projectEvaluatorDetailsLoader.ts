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
        tracingEnabled
        evaluator {
          kind
          description
          ... on CodeEvaluator {
            id
            versionCount
          }
        }
        traceProject {
          id
        }
        runSummary {
          status
          queuedCount
          runningCount
        }
        ...ProjectEvaluatorStats_projectEvaluator
        ...ProjectEvaluatorScopeDetails_projectEvaluator
        ...ProjectEvaluatorAdvancedDetails_projectEvaluator
        ...LLMProjectEvaluatorDetails_projectEvaluator
        ...CodeProjectEvaluatorDetails_projectEvaluator
        ...DecisionProjectEvaluatorDetails_projectEvaluator
        ...CodeProjectEvaluatorConfigCards_projectEvaluator
        ...ProjectEvaluatorMetrics_projectEvaluator
        ...AnnotationConfigurationCard_projectEvaluator
      }
    }
  }
`;

/** The breadcrumb for an evaluator whose name is not known. */
export const PROJECT_EVALUATOR_CRUMB_FALLBACK = "evaluator";

export type ProjectEvaluatorDetailsLoaderData = ReturnType<
  typeof projectEvaluatorDetailsLoader
>;

/**
 * Starts loading the project evaluator details page.
 *
 * Nothing here is awaited, so the router commits the navigation at once and
 * the page shows its skeleton while the query is in flight. The page reads
 * the query ref; the server rejects a deleted or malformed id, and the page
 * renders that rejection as its not-found state.
 *
 * The breadcrumb needs the evaluator's name, which only the response holds,
 * so it is handed over as a promise the breadcrumb resolves on its own. It
 * shares the query ref's request, and never rejects: an evaluator that
 * cannot be loaded gets the generic crumb.
 */
export function projectEvaluatorDetailsLoader(args: LoaderFunctionArgs): {
  queryRef: ReturnType<typeof loadQuery<projectEvaluatorDetailsLoaderQuery>>;
  evaluatorDisplayName: Promise<string>;
} {
  const { projectEvaluatorId } = args.params;
  invariant(projectEvaluatorId, "projectEvaluatorId is required");
  const variables = { projectEvaluatorId };
  // Rendered from the store when the evaluator was seen before, say from the
  // evaluators table, and refreshed behind that render so an edit saved
  // elsewhere is picked up on the next visit.
  const queryRef = loadQuery<projectEvaluatorDetailsLoaderQuery>(
    RelayEnvironment,
    projectEvaluatorDetailsLoaderGQL,
    variables,
    { fetchPolicy: "store-and-network" }
  );
  const evaluatorDisplayName = fetchQuery<projectEvaluatorDetailsLoaderQuery>(
    RelayEnvironment,
    projectEvaluatorDetailsLoaderGQL,
    variables,
    { fetchPolicy: "store-or-network" }
  )
    .toPromise()
    .then(
      (data) => {
        const node = data?.projectEvaluator;
        return (
          (node?.__typename === "ProjectEvaluator" ? node.name : null) ||
          PROJECT_EVALUATOR_CRUMB_FALLBACK
        );
      },
      () => PROJECT_EVALUATOR_CRUMB_FALLBACK
    );
  return { queryRef, evaluatorDisplayName };
}
