import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Heading, Loading, Text, View } from "@phoenix/components";
import { datasetEvaluatorDetailsLoaderQuery } from "@phoenix/pages/dataset/evaluators/__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";
import { BuiltInDatasetEvaluatorDetails } from "@phoenix/pages/dataset/evaluators/BuiltInDatasetEvaluatorDetails";
import {
  datasetEvaluatorDetailsLoader,
  datasetEvaluatorDetailsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorDetailsLoader";
import { LLMDatasetEvaluatorDetails } from "@phoenix/pages/dataset/evaluators/LLMDatasetEvaluatorDetails";

const mainCSS = css`
  display: flex;
  overflow: hidden;
  flex-direction: column;
  height: 100%;
`;

export function DatasetEvaluatorDetailsPage() {
  const loaderData = useLoaderData<typeof datasetEvaluatorDetailsLoader>();
  invariant(loaderData, "loaderData is required");
  const data = usePreloadedQuery<datasetEvaluatorDetailsLoaderQuery>(
    datasetEvaluatorDetailsLoaderGQL,
    loaderData.queryRef
  );

  return (
    <Suspense fallback={<Loading />}>
      <DatasetEvaluatorDetailsPageContent data={data} />
    </Suspense>
  );
}

function DatasetEvaluatorDetailsPageContent({
  data,
}: {
  data: datasetEvaluatorDetailsLoaderQuery["response"];
}) {
  const datasetEvaluator = data.dataset.datasetEvaluator;
  invariant(datasetEvaluator, "datasetEvaluator is required");
  const evaluator = datasetEvaluator.evaluator;

  return (
    <main css={mainCSS}>
      <View
        borderBottomColor="dark"
        borderBottomWidth="thin"
        padding="size-200"
        flex="none"
      >
        <Heading level={1}>Evaluator: {datasetEvaluator.displayName}</Heading>
        <Text size="M">{evaluator.description}</Text>
      </View>
      {evaluator.__typename === "LLMEvaluator" && (
        <LLMDatasetEvaluatorDetails evaluatorRef={evaluator} />
      )}
      {evaluator.__typename === "BuiltInEvaluator" && (
        <BuiltInDatasetEvaluatorDetails
          datasetEvaluatorRef={datasetEvaluator}
        />
      )}
    </main>
  );
}
