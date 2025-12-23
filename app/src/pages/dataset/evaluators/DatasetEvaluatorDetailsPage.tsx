import { Suspense, useState } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  Loading,
  Text,
  View,
} from "@phoenix/components";
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
  const { datasetId } = useParams();
  invariant(datasetId, "datasetId is required");
  const datasetEvaluator = data.dataset.datasetEvaluator;
  invariant(datasetEvaluator, "datasetEvaluator is required");
  const evaluator = datasetEvaluator.evaluator;
  const [isEditSlideoverOpen, setIsEditSlideoverOpen] = useState(false);

  const isLLMEvaluator = evaluator.__typename === "LLMEvaluator";
  const isBuiltInEvaluator = evaluator.__typename === "BuiltInEvaluator";

  return (
    <main css={mainCSS}>
      <View
        borderBottomColor="dark"
        borderBottomWidth="thin"
        padding="size-200"
        flex="none"
      >
        <Flex justifyContent="space-between" alignItems="center">
          <Flex direction="column" gap="size-50">
            <Heading level={1}>
              Evaluator: {datasetEvaluator.displayName}
            </Heading>
            <Text size="M">{evaluator.description}</Text>
          </Flex>
          <Button
            variant="primary"
            onPress={() => setIsEditSlideoverOpen(true)}
            leadingVisual={<Icon svg={<Icons.EditOutline />} />}
          >
            Edit
          </Button>
        </Flex>
      </View>
      {isLLMEvaluator && (
        <LLMDatasetEvaluatorDetails
          datasetEvaluatorRef={datasetEvaluator}
          datasetId={datasetId}
          isEditSlideoverOpen={isEditSlideoverOpen}
          onEditSlideoverOpenChange={setIsEditSlideoverOpen}
        />
      )}
      {isBuiltInEvaluator && (
        <BuiltInDatasetEvaluatorDetails
          datasetEvaluatorRef={datasetEvaluator}
          datasetId={datasetId}
          isEditSlideoverOpen={isEditSlideoverOpen}
          onEditSlideoverOpenChange={setIsEditSlideoverOpen}
        />
      )}
    </main>
  );
}
