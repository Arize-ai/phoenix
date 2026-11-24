import { Suspense } from "react";
import { graphql, useFragment, useLazyLoadQuery } from "react-relay";
import { useParams } from "react-router";

import { Flex, Text } from "@phoenix/components";
import { useTimeRange } from "@phoenix/components/datetime";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";

import type { DocumentEvaluationSummaryQuery } from "./__generated__/DocumentEvaluationSummaryQuery.graphql";
import type { DocumentEvaluationSummaryValueFragment$key } from "./__generated__/DocumentEvaluationSummaryValueFragment.graphql";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";

type DocumentEvaluationSummaryProps = {
  evaluationName: string;
};
export function DocumentEvaluationSummary({
  evaluationName,
}: DocumentEvaluationSummaryProps) {
  const { projectId } = useParams();
  const { timeRangeISOStrings } = useTimeRange();
  const { throttledFetchKey } = useStreamState();
  const data = useLazyLoadQuery<DocumentEvaluationSummaryQuery>(
    graphql`
      query DocumentEvaluationSummaryQuery(
        $evaluationName: String!
        $id: ID!
        $timeRange: TimeRange!
      ) {
        project: node(id: $id) {
          ...DocumentEvaluationSummaryValueFragment
            @arguments(evaluationName: $evaluationName, timeRange: $timeRange)
        }
      }
    `,
    {
      id: projectId as string,
      evaluationName,
      timeRange: timeRangeISOStrings,
    },
    { fetchKey: throttledFetchKey, fetchPolicy: "store-and-network" }
  );
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" size="S" color="text-700">
        {evaluationName}
      </Text>
      <Suspense fallback={<Text size="L">--</Text>}>
        <EvaluationSummaryValue
          evaluationName={evaluationName}
          project={data?.project}
        />
      </Suspense>
    </Flex>
  );
}

function EvaluationSummaryValue(props: {
  evaluationName: string;
  project: DocumentEvaluationSummaryValueFragment$key;
}) {
  const { project } = props;
  const data = useFragment<DocumentEvaluationSummaryValueFragment$key>(
    graphql`
      fragment DocumentEvaluationSummaryValueFragment on Project
      @argumentDefinitions(
        evaluationName: { type: "String!" }
        timeRange: { type: "TimeRange!" }
      ) {
        documentEvaluationSummary(
          evaluationName: $evaluationName
          timeRange: $timeRange
        ) {
          averageNdcg
          averagePrecision
          meanReciprocalRank
          hitRate
        }
      }
    `,
    project
  );

  const averageNdcg = data?.documentEvaluationSummary?.averageNdcg;
  const averagePrecision = data?.documentEvaluationSummary?.averagePrecision;
  const hitRate = data?.documentEvaluationSummary?.hitRate;

  return (
    <Flex direction="row" alignItems="center" gap="size-50" height="28px">
      <>
        <RetrievalEvaluationLabel
          key="ndcg"
          metric="ndcg"
          score={averageNdcg}
        />
        <RetrievalEvaluationLabel
          key="precision"
          metric="precision"
          score={averagePrecision}
        />
        <RetrievalEvaluationLabel key="hit" metric="hit rate" score={hitRate} />
      </>
    </Flex>
  );
}
