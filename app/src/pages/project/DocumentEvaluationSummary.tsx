import React, { startTransition, Suspense, useEffect } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";
import { useParams } from "react-router";

import {
  Flex,
  HelpTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@arizeai/components";

import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { DocumentEvaluationSummaryQuery } from "./__generated__/DocumentEvaluationSummaryQuery.graphql";
import { DocumentEvaluationSummaryValueFragment$key } from "./__generated__/DocumentEvaluationSummaryValueFragment.graphql";
import { RetrievalEvaluationLabel } from "./RetrievalEvaluationLabel";

type DocumentEvaluationSummaryProps = {
  evaluationName: string;
};
export function DocumentEvaluationSummary({
  evaluationName,
}: DocumentEvaluationSummaryProps) {
  const { projectId } = useParams();
  const data = useLazyLoadQuery<DocumentEvaluationSummaryQuery>(
    graphql`
      query DocumentEvaluationSummaryQuery(
        $evaluationName: String!
        $id: GlobalID!
      ) {
        project: node(id: $id) {
          ...DocumentEvaluationSummaryValueFragment
            @arguments(evaluationName: $evaluationName)
        }
      }
    `,
    {
      id: projectId as string,
      evaluationName,
    }
  );
  return (
    <Flex direction="column" flex="none">
      <Text elementType="h3" textSize="medium" color="text-700">
        {evaluationName}
      </Text>
      <Suspense fallback={<Text textSize="xlarge">--</Text>}>
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
  const { fetchKey } = useStreamState();
  const [data, refetch] = useRefetchableFragment<
    DocumentEvaluationSummaryQuery,
    DocumentEvaluationSummaryValueFragment$key
  >(
    graphql`
      fragment DocumentEvaluationSummaryValueFragment on Project
      @refetchable(queryName: "DocumentEvaluationSummaryValueQuery")
      @argumentDefinitions(evaluationName: { type: "String!" }) {
        documentEvaluationSummary(evaluationName: $evaluationName) {
          averageNdcg
          averagePrecision
          meanReciprocalRank
          hitRate
        }
      }
    `,
    project
  );

  // Refetch the evaluation summary if the fetchKey changes
  useEffect(() => {
    startTransition(() => {
      refetch({}, { fetchPolicy: "store-and-network" });
    });
  }, [fetchKey, refetch]);

  const averageNdcg = data?.documentEvaluationSummary?.averageNdcg;
  const averagePrecision = data?.documentEvaluationSummary?.averagePrecision;
  const hitRate = data?.documentEvaluationSummary?.hitRate;
  const meanReciprocalRank =
    data?.documentEvaluationSummary?.meanReciprocalRank;

  return (
    <TooltipTrigger delay={0} placement="bottom">
      <TriggerWrap>
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
            <RetrievalEvaluationLabel
              key="hit"
              metric="hit rate"
              score={hitRate}
            />
          </>
        </Flex>
      </TriggerWrap>
      <HelpTooltip>
        <View width="size-2400">
          <Flex direction="column">
            <Flex justifyContent="space-between">
              <Text>average ndcg</Text>
              <Text>
                {typeof averageNdcg === "number"
                  ? formatFloat(averageNdcg)
                  : "--"}
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text>average precision</Text>
              <Text>
                {typeof averagePrecision === "number"
                  ? formatFloat(averagePrecision)
                  : "--"}
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text>mean reciprocal rank</Text>
              <Text>
                {typeof meanReciprocalRank === "number"
                  ? formatFloat(meanReciprocalRank)
                  : "--"}
              </Text>
            </Flex>
            <Flex justifyContent="space-between">
              <Text>hit rate</Text>
              <Text>
                {typeof hitRate === "number" ? formatFloat(hitRate) : "--"}
              </Text>
            </Flex>
          </Flex>
        </View>
      </HelpTooltip>
    </TooltipTrigger>
  );
}
