import { startTransition, useEffect, useEffectEvent } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";

import type { AnnotationConfig } from "@phoenix/components/annotation";
import { useTimeRange } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";

import type { TraceAnnotationSummaryQuery } from "./__generated__/TraceAnnotationSummaryQuery.graphql";
import type { TraceAnnotationSummaryValueFragment$key } from "./__generated__/TraceAnnotationSummaryValueFragment.graphql";
import { Summary, SummaryValue } from "./AnnotationSummary";

type TraceAnnotationSummaryProps = {
  annotationName: string;
  /**
   * Optional span filter condition. When set, the trace annotation summary is
   * restricted to traces whose spans match the condition.
   */
  filterCondition?: string | null;
};

/**
 * Project-level summary for a single trace annotation. Mirrors
 * {@link AnnotationSummary} (which summarizes span annotations) so trace-level
 * feedback can sit alongside span and document feedback in the stats panel.
 */
export function TraceAnnotationSummary({
  annotationName,
  filterCondition,
}: TraceAnnotationSummaryProps) {
  const { projectId } = useParams();
  const { timeRange } = useTimeRange();
  const data = useLazyLoadQuery<TraceAnnotationSummaryQuery>(
    graphql`
      query TraceAnnotationSummaryQuery(
        $id: ID!
        $annotationName: String!
        $timeRange: TimeRange!
        $filterCondition: String
      ) {
        project: node(id: $id) {
          ...TraceAnnotationSummaryValueFragment
            @arguments(
              annotationName: $annotationName
              timeRange: $timeRange
              filterCondition: $filterCondition
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
      filterCondition: filterCondition || null,
    }
  );
  return (
    <Summary name={annotationName}>
      <TraceAnnotationSummaryValue
        annotationName={annotationName}
        filterCondition={filterCondition || null}
        project={data.project}
      />
    </Summary>
  );
}

function TraceAnnotationSummaryValue(props: {
  annotationName: string;
  filterCondition: string | null;
  project: TraceAnnotationSummaryValueFragment$key;
}) {
  const { project, annotationName, filterCondition } = props;
  const { fetchKey } = useStreamState();
  const [data, refetch] = useRefetchableFragment<
    TraceAnnotationSummaryQuery,
    TraceAnnotationSummaryValueFragment$key
  >(
    graphql`
      fragment TraceAnnotationSummaryValueFragment on Project
      @refetchable(queryName: "TraceAnnotationSummaryValueQuery")
      @argumentDefinitions(
        annotationName: { type: "String!" }
        timeRange: { type: "TimeRange!" }
        filterCondition: { type: "String", defaultValue: null }
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
        traceAnnotationSummary(
          annotationName: $annotationName
          timeRange: $timeRange
          filterCondition: $filterCondition
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

  const refetchAnnotationSummary = useEffectEvent(() => {
    startTransition(() => {
      refetch({ filterCondition }, { fetchPolicy: "store-and-network" });
    });
  });

  // Refetch the annotation summary when streaming data advances.
  useEffect(() => {
    refetchAnnotationSummary();
  }, [fetchKey]);

  return (
    <SummaryValue
      name={annotationName}
      meanScore={data?.traceAnnotationSummary?.meanScore}
      labelFractions={data?.traceAnnotationSummary?.labelFractions}
      count={data?.traceAnnotationSummary?.count}
      scoreCount={data?.traceAnnotationSummary?.scoreCount}
      labelCount={data?.traceAnnotationSummary?.labelCount}
      annotationConfig={
        data?.annotationConfigs?.edges.find(
          (edge) => edge.node.name === annotationName
        )?.node as AnnotationConfig | undefined
      }
    />
  );
}
