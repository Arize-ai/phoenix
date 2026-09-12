import { useEffect } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import type { EvaluatorPlaygroundProjectSampleQuery } from "./__generated__/EvaluatorPlaygroundProjectSampleQuery.graphql";
import { createSpanSampleRow } from "./evaluatorPlaygroundSpanRows";
import type { SampleExample } from "./evaluatorResults";

/**
 * The project counterpart of `EvaluatorPlaygroundSample`: the most recent spans
 * matching the filter inside the time window, read through their evaluation
 * context so each row has an example's shape. Span target only; a trace or
 * session target would query a different connection here.
 */
export function EvaluatorPlaygroundProjectSample({
  fetchKey,
  projectId,
  first,
  filterCondition,
  startIso,
  onLoad,
}: {
  fetchKey: string;
  projectId: string;
  /** How many spans to load — the sample size. */
  first: number;
  /** An applied filter, or an empty string for every span. */
  filterCondition: string;
  /** The start of the time window, fixed when the window was chosen. */
  startIso: string;
  onLoad: (rows: SampleExample[]) => void;
}) {
  const data = useLazyLoadQuery<EvaluatorPlaygroundProjectSampleQuery>(
    graphql`
      query EvaluatorPlaygroundProjectSampleQuery(
        $projectId: ID!
        $first: Int!
        $filterCondition: String
        $start: DateTime!
      ) {
        node(id: $projectId) {
          ... on Project {
            spans(
              first: $first
              sort: { col: startTime, dir: desc }
              filterCondition: $filterCondition
              timeRange: { start: $start }
            ) {
              edges {
                node {
                  id
                  name
                  evaluationContext
                  spanAnnotations {
                    id
                    name
                    annotatorKind
                    label
                    score
                    explanation
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      projectId,
      first,
      filterCondition: filterCondition.trim() || null,
      start: startIso,
    },
    { fetchPolicy: "network-only", fetchKey }
  );

  // Synchronize a retained query with the parent-owned execution snapshot, as
  // the dataset sample does; the parent keys this component by scope.
  useEffect(() => {
    onLoad(
      data.node?.spans?.edges.map(({ node }) => createSpanSampleRow(node)) ?? []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
