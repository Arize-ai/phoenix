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
  /** The sessions table's active filter, so the summary covers the rows it lists. */
  sessionFilterCondition: string | null;
};

/**
 * Project-level summary for a single session annotation. Mirrors
 * {@link AnnotationSummary} (which summarizes span annotations) so
 * session-level feedback can sit in the sessions table stats panel.
 */
export function SessionAnnotationSummary({
  annotationName,
  sessionFilterCondition,
}: SessionAnnotationSummaryProps) {
  const { projectId } = useParams();
  const { timeRangeISOStrings } = useTimeRange();
  const data = useLazyLoadQuery<SessionAnnotationSummaryQuery>(
    graphql`
      query SessionAnnotationSummaryQuery(
        $id: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $sessionFilterCondition: String
      ) {
        project: node(id: $id) {
          ...SessionAnnotationSummaryValueFragment
            @arguments(
              annotationName: $annotationName
              timeRange: $timeRange
              sessionFilterCondition: $sessionFilterCondition
            )
        }
      }
    `,
    {
      annotationName,
      id: projectId as string,
      timeRange: timeRangeISOStrings,
      sessionFilterCondition,
    }
  );
  return (
    <Summary name={annotationName}>
      <SessionAnnotationSummaryValue
        annotationName={annotationName}
        project={data.project}
      />
    </Summary>
  );
}

function SessionAnnotationSummaryValue(props: {
  annotationName: string;
  project: SessionAnnotationSummaryValueFragment$key;
}) {
  const { project, annotationName } = props;
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
        sessionFilterCondition: { type: "String", defaultValue: null }
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
          sessionFilterCondition: $sessionFilterCondition
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
      refetch({}, { fetchPolicy: "store-and-network" });
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
