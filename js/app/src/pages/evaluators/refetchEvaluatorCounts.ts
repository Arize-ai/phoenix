import type { Environment } from "react-relay";
import { fetchQuery, graphql } from "react-relay";

import type { refetchEvaluatorCountsQuery } from "@phoenix/pages/evaluators/__generated__/refetchEvaluatorCountsQuery.graphql";

const query = graphql`
  query refetchEvaluatorCountsQuery {
    projectEvaluatorCount
    datasetEvaluatorCount
  }
`;

/**
 * Refetches the project and dataset evaluator counts, which the sidebar and
 * the Evaluators page's tabs show. A failed refetch is ignored: the counts
 * refresh again the next time those queries load.
 */
export function refetchEvaluatorCounts({
  environment,
}: {
  environment: Environment;
}) {
  fetchQuery<refetchEvaluatorCountsQuery>(
    environment,
    query,
    {},
    { fetchPolicy: "network-only" }
  ).subscribe({ error: () => {} });
}
