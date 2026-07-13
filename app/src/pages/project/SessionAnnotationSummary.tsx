import { startTransition } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";

import { useTimeRange } from "@phoenix/components/datetime";

import type { SessionAnnotationSummaryQuery } from "./__generated__/SessionAnnotationSummaryQuery.graphql";
import type { SessionAnnotationSummaryValueFragment$key } from "./__generated__/SessionAnnotationSummaryValueFragment.graphql";
import {
  AnnotationSummaryValueView,
  Summary,
  useRefetchOnStreamAdvance,
} from "./AnnotationSummary";

type SessionAnnotationSummaryProps = {
  annotationName: string;
  /**
   * The sessions table search text. Like the table, the summary treats it as
   * both an input/output substring filter and an exact session-ID lookup,
   * with an exact match taking precedence.
   */
  filterIoSubstringOrSessionId?: string | null;
};

/**
 * Project-level summary for a single session annotation. Mirrors
 * {@link AnnotationSummary} (which summarizes span annotations) so
 * session-level feedback can sit in the sessions table stats panel.
 */
export function SessionAnnotationSummary({
  annotationName,
  filterIoSubstringOrSessionId,
}: SessionAnnotationSummaryProps) {
  const { projectId } = useParams();
  const { timeRangeISOStrings } = useTimeRange();
  const data = useLazyLoadQuery<SessionAnnotationSummaryQuery>(
    graphql`
      query SessionAnnotationSummaryQuery(
        $id: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $filterIoSubstring: String
        $sessionId: String
      ) {
        project: node(id: $id) {
          ...SessionAnnotationSummaryValueFragment
            @arguments(
              annotationName: $annotationName
              timeRange: $timeRange
              filterIoSubstring: $filterIoSubstring
              sessionId: $sessionId
            )
        }
      }
    `,
    {
      annotationName,
      id: projectId as string,
      timeRange: timeRangeISOStrings,
      filterIoSubstring: filterIoSubstringOrSessionId || null,
      sessionId: filterIoSubstringOrSessionId || null,
    }
  );
  return (
    <Summary name={annotationName}>
      <SessionAnnotationSummaryValue
        annotationName={annotationName}
        filterIoSubstringOrSessionId={filterIoSubstringOrSessionId || null}
        project={data.project}
      />
    </Summary>
  );
}

function SessionAnnotationSummaryValue(props: {
  annotationName: string;
  filterIoSubstringOrSessionId: string | null;
  project: SessionAnnotationSummaryValueFragment$key;
}) {
  const { project, annotationName, filterIoSubstringOrSessionId } = props;
  const [data, refetch] = useRefetchableFragment<
    SessionAnnotationSummaryQuery,
    SessionAnnotationSummaryValueFragment$key
  >(
    graphql`
      fragment SessionAnnotationSummaryValueFragment on Project
      @refetchable(queryName: "SessionAnnotationSummaryValueQuery")
      @argumentDefinitions(
        annotationName: { type: "String!" }
        timeRange: { type: "TimeRange!" }
        filterIoSubstring: { type: "String", defaultValue: null }
        sessionId: { type: "String", defaultValue: null }
      ) {
        annotationConfigs {
          edges {
            node {
              ... on AnnotationConfigBase {
                annotationType
              }
              ... on CategoricalAnnotationConfig {
                annotationType
                id
                optimizationDirection
                name
                values {
                  label
                  score
                }
              }
            }
          }
        }
        sessionAnnotationSummary(
          annotationName: $annotationName
          timeRange: $timeRange
          filterIoSubstring: $filterIoSubstring
          sessionId: $sessionId
        ) {
          name
          count
          scoreCount
          labelCount
          labelFractions {
            label
            fraction
          }
          meanScore
        }
      }
    `,
    project
  );

  useRefetchOnStreamAdvance(() => {
    startTransition(() => {
      refetch(
        {
          filterIoSubstring: filterIoSubstringOrSessionId,
          sessionId: filterIoSubstringOrSessionId,
        },
        { fetchPolicy: "store-and-network" }
      );
    });
  });

  return (
    <AnnotationSummaryValueView
      name={annotationName}
      summary={data?.sessionAnnotationSummary}
      annotationConfigs={data?.annotationConfigs}
    />
  );
}
