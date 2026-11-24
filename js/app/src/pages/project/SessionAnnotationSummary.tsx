import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";

import { useTimeRange } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";

import type { SessionAnnotationSummaryQuery } from "./__generated__/SessionAnnotationSummaryQuery.graphql";
import type { SessionAnnotationSummaryValueFragment$key } from "./__generated__/SessionAnnotationSummaryValueFragment.graphql";
import { AnnotationSummaryValueView, Summary } from "./AnnotationSummary";

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
  const { throttledFetchKey } = useStreamState();
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
    },
    { fetchKey: throttledFetchKey, fetchPolicy: "store-and-network" }
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
  const data = useFragment<SessionAnnotationSummaryValueFragment$key>(
    graphql`
      fragment SessionAnnotationSummaryValueFragment on Project
      @argumentDefinitions(
        annotationName: { type: "String!" }
        timeRange: { type: "TimeRange!" }
        sessionFilterCondition: { type: "String", defaultValue: null }
      ) {
        ...ProjectAnnotationConfigsByNameFragment
          @arguments(annotationConfigNames: [$annotationName], first: 1)
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

  return (
    <AnnotationSummaryValueView
      name={annotationName}
      summary={data?.sessionAnnotationSummary}
      project={data}
    />
  );
}
