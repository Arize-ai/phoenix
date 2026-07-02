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
   * Optional input/output substring filter. When set, the session annotation
   * summary is restricted to sessions whose root span input/output contains
   * the substring.
   */
  filterIoSubstring?: string | null;
};

/**
 * Project-level summary for a single session annotation. Mirrors
 * {@link AnnotationSummary} (which summarizes span annotations) so
 * session-level feedback can sit in the sessions table stats panel.
 */
export function SessionAnnotationSummary({
  annotationName,
  filterIoSubstring,
}: SessionAnnotationSummaryProps) {
  const { projectId } = useParams();
  const { timeRange } = useTimeRange();
  const data = useLazyLoadQuery<SessionAnnotationSummaryQuery>(
    graphql`
      query SessionAnnotationSummaryQuery(
        $id: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $filterIoSubstring: String
      ) {
        project: node(id: $id) {
          ...SessionAnnotationSummaryValueFragment
            @arguments(
              annotationName: $annotationName
              timeRange: $timeRange
              filterIoSubstring: $filterIoSubstring
            )
        }
      }
    `,
    {
      annotationName,
      id: projectId as string,
      timeRange: {
        start: timeRange?.start?.toISOString(),
        end: timeRange?.end?.toISOString(),
      },
      filterIoSubstring: filterIoSubstring || null,
    }
  );
  return (
    <Summary name={annotationName}>
      <SessionAnnotationSummaryValue
        annotationName={annotationName}
        filterIoSubstring={filterIoSubstring || null}
        project={data.project}
      />
    </Summary>
  );
}

function SessionAnnotationSummaryValue(props: {
  annotationName: string;
  filterIoSubstring: string | null;
  project: SessionAnnotationSummaryValueFragment$key;
}) {
  const { project, annotationName, filterIoSubstring } = props;
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
      refetch({ filterIoSubstring }, { fetchPolicy: "store-and-network" });
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
