import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { Outlet, useLoaderData, useParams, useRevalidator } from "react-router";
import invariant from "tiny-invariant";

import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  LazyTabPanel,
  Loading,
  PageHeader,
  Tab,
  TabList,
  Tabs,
  View,
} from "@phoenix/components";
import { Counter } from "@phoenix/components/core/counter";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { EditCodeDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditCodeDatasetEvaluatorSlideover";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import { useOwnedPreloadedQuery } from "@phoenix/hooks";
import type { datasetEvaluatorDetailsLoaderQuery } from "@phoenix/pages/dataset/evaluators/__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";
import { BuiltInDatasetEvaluatorDetails } from "@phoenix/pages/dataset/evaluators/BuiltInDatasetEvaluatorDetails";
import { CodeDatasetEvaluatorDetails } from "@phoenix/pages/dataset/evaluators/CodeDatasetEvaluatorDetails";
import { CodeDatasetEvaluatorVersions } from "@phoenix/pages/dataset/evaluators/CodeDatasetEvaluatorVersions";
import type { datasetEvaluatorDetailsLoader } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorDetailsLoader";
import { datasetEvaluatorDetailsLoaderGQL } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorDetailsLoader";
import { DatasetEvaluatorSpans } from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorSpans";
import { LLMDatasetEvaluatorDetails } from "@phoenix/pages/dataset/evaluators/LLMDatasetEvaluatorDetails";

const mainCSS = css`
  display: flex;
  overflow: hidden;
  flex-direction: column;
  height: 100%;
  .tabs {
    flex: 1 1 auto;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    div[role="tablist"] {
      flex: none;
    }
  }
`;

export function DatasetEvaluatorDetailsPage() {
  const loaderData = useLoaderData<typeof datasetEvaluatorDetailsLoader>();
  invariant(loaderData, "loaderData is required");
  const data = useOwnedPreloadedQuery<datasetEvaluatorDetailsLoaderQuery>({
    query: datasetEvaluatorDetailsLoaderGQL,
    queryRef: loaderData.queryRef,
  });

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
  const { revalidate } = useRevalidator();

  const isLLMEvaluator = evaluator.__typename === "LLMEvaluator";
  const isBuiltInEvaluator = evaluator.__typename === "BuiltInEvaluator";
  const isCodeEvaluator = evaluator.__typename === "CodeEvaluator";
  const versionsCount =
    evaluator.__typename === "CodeEvaluator" ? evaluator.versionCount : 0;

  return (
    <main css={mainCSS}>
      <PageHeader
        title={
          <Heading level={1}>
            <Truncate
              maxWidth="100%"
              title={`Evaluator: ${datasetEvaluator.name}`}
            >{`Evaluator: ${datasetEvaluator.name}`}</Truncate>
          </Heading>
        }
        subTitle={datasetEvaluator.description}
        extra={
          <Button
            variant="primary"
            onPress={() => setIsEditSlideoverOpen(true)}
            leadingVisual={<Icon svg={<Icons.EditOutline />} />}
          >
            Edit
          </Button>
        }
      />
      <Tabs defaultSelectedKey="configuration">
        <TabList>
          <Tab id="configuration">Configuration</Tab>
          {isCodeEvaluator && (
            <Tab id="versions">
              Versions <Counter>{versionsCount}</Counter>
            </Tab>
          )}
          <Tab id="spans">Spans</Tab>
        </TabList>
        <LazyTabPanel id="configuration">
          <View width="100%" overflow="auto" height="100%">
            <View padding="size-200">
              <Flex
                direction="column"
                gap="size-300"
                maxWidth={1600}
                marginStart="auto"
                marginEnd="auto"
              >
                {isLLMEvaluator && (
                  <LLMDatasetEvaluatorDetails
                    datasetEvaluatorRef={datasetEvaluator}
                  />
                )}
                {isBuiltInEvaluator && (
                  <BuiltInDatasetEvaluatorDetails
                    datasetEvaluatorRef={datasetEvaluator}
                  />
                )}
                {isCodeEvaluator && (
                  <CodeDatasetEvaluatorDetails
                    datasetEvaluatorRef={datasetEvaluator}
                    sandboxBackends={data.sandboxBackends}
                  />
                )}
              </Flex>
            </View>
          </View>
        </LazyTabPanel>
        {isCodeEvaluator && (
          <LazyTabPanel id="versions">
            <Suspense fallback={<Loading />}>
              <CodeDatasetEvaluatorVersions
                datasetEvaluatorId={datasetEvaluator.id}
              />
            </Suspense>
          </LazyTabPanel>
        )}
        <LazyTabPanel id="spans">
          <DatasetEvaluatorSpans projectRef={datasetEvaluator.project} />
        </LazyTabPanel>
      </Tabs>
      {isLLMEvaluator && (
        <EditLLMDatasetEvaluatorSlideover
          datasetEvaluatorId={datasetEvaluator.id}
          datasetId={datasetId}
          isOpen={isEditSlideoverOpen}
          onOpenChange={setIsEditSlideoverOpen}
          onUpdate={() => revalidate()}
        />
      )}
      {isBuiltInEvaluator && (
        <EditBuiltInDatasetEvaluatorSlideover
          datasetEvaluatorId={datasetEvaluator.id}
          datasetId={datasetId}
          isOpen={isEditSlideoverOpen}
          onOpenChange={setIsEditSlideoverOpen}
          onUpdate={() => revalidate()}
        />
      )}
      {isCodeEvaluator && (
        <EditCodeDatasetEvaluatorSlideover
          datasetEvaluatorId={datasetEvaluator.id}
          datasetId={datasetId}
          isOpen={isEditSlideoverOpen}
          onOpenChange={setIsEditSlideoverOpen}
          onUpdate={() => revalidate()}
        />
      )}
      <Suspense>
        <Outlet />
      </Suspense>
    </main>
  );
}
