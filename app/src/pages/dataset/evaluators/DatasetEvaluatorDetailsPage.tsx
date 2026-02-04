import { Suspense, useState } from "react";
import { usePreloadedQuery } from "react-relay";
import { Outlet, useLoaderData, useParams } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import {
  Button,
  Icon,
  Icons,
  LazyTabPanel,
  Loading,
  PageHeader,
  Tab,
  TabList,
  Tabs,
} from "@phoenix/components";
import { datasetEvaluatorDetailsLoaderQuery } from "@phoenix/pages/dataset/evaluators/__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";
import { BuiltInDatasetEvaluatorDetails } from "@phoenix/pages/dataset/evaluators/BuiltInDatasetEvaluatorDetails";
import {
  datasetEvaluatorDetailsLoader,
  datasetEvaluatorDetailsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorDetailsLoader";
import { DatasetEvaluatorTraces } from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorTraces";
import { LLMDatasetEvaluatorDetails } from "@phoenix/pages/dataset/evaluators/LLMDatasetEvaluatorDetails";

const mainCSS = css`
  display: flex;
  overflow: hidden;
  flex-direction: column;
  height: 100%;
  .ac-tabs {
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
      <PageHeader
        title={`Evaluator: ${datasetEvaluator.name}`}
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
          <Tab id="traces">Traces</Tab>
        </TabList>
        <LazyTabPanel id="configuration">
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
        </LazyTabPanel>
        <LazyTabPanel id="traces">
          <DatasetEvaluatorTraces projectRef={datasetEvaluator.project} />
        </LazyTabPanel>
      </Tabs>
      <Suspense>
        <Outlet />
      </Suspense>
    </main>
  );
}
