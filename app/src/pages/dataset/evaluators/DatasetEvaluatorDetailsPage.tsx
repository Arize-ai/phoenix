import { Suspense } from "react";
import { usePreloadedQuery } from "react-relay";
import { useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Loading } from "@phoenix/components";
import { datasetEvaluatorDetailsLoaderQuery } from "@phoenix/pages/dataset/evaluators/__generated__/datasetEvaluatorDetailsLoaderQuery.graphql";
import {
  datasetEvaluatorDetailsLoader,
  datasetEvaluatorDetailsLoaderGQL,
} from "@phoenix/pages/dataset/evaluators/datasetEvaluatorDetailsLoader";

const mainCSS = css`
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  data: _data,
}: {
  data: datasetEvaluatorDetailsLoaderQuery["response"];
}) {
  return <main css={mainCSS}>Evaluator Details</main>;
}
