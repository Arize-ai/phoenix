import React, { Suspense } from "react";
import { graphql, useLazyLoadQuery, useRefetchableFragment } from "react-relay";

import { Flex, Text } from "@arizeai/components";

import { EvaluationSummaryQuery } from "./__generated__/EvaluationSummaryQuery.graphql";
import {
  EvaluationSummaryValueFragment$data,
  EvaluationSummaryValueFragment$key,
} from "./__generated__/EvaluationSummaryValueFragment.graphql";

type EvaluationSummaryProps = {
  evaluationName: string;
};
export function EvaluationSummary({ evaluationName }: EvaluationSummaryProps) {
  const data = useLazyLoadQuery<EvaluationSummaryQuery>(
    graphql`
      query EvaluationSummaryQuery($evaluationName: String!) {
        ...EvaluationSummaryValueFragment
          @arguments(evaluationName: $evaluationName)
      }
    `,
    {
      evaluationName,
    }
  );
  return (
    <Flex direction="column">
      <Text elementType="h3" textSize="medium" color="text-700">
        {evaluationName}
      </Text>
      <Suspense fallback={<Text textSize="xlarge">--</Text>}>
        <EvaluationSummaryValue evaluationName={evaluationName} query={data} />
      </Suspense>
    </Flex>
  );
}

function EvaluationSummaryValue(props: { evaluationName: string; query: any }) {
  const { query } = props;
  const [data] = useRefetchableFragment<
    EvaluationSummaryQuery,
    EvaluationSummaryValueFragment$key
  >(
    graphql`
      fragment EvaluationSummaryValueFragment on Query
      @refetchable(queryName: "EvaluationSummaryValueQuery")
      @argumentDefinitions(evaluationName: { type: "String!" }) {
        spanEvaluationSummary(evaluationName: $evaluationName) {
          labelFractions {
            label
            fraction
          }
          meanScore
        }
      }
    `,
    query
  );

  return <Text textSize="xlarge">{JSON.stringify(data)}</Text>;
}
