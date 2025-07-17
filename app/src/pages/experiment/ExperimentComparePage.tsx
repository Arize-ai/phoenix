import { startTransition, Suspense, useState } from "react";
import {
  useLoaderData,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Switch } from "@arizeai/components";

import { Alert, Flex, Loading, View } from "@phoenix/components";
import { experimentCompareLoader } from "@phoenix/pages/experiment/experimentCompareLoader";

import { ExperimentCompareTable } from "./ExperimentCompareTable";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";
import { ExperimentRunFilterConditionProvider } from "./ExperimentRunFilterConditionContext";

export function ExperimentComparePage() {
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  invariant(loaderData, "loaderData is required");
  // The text of most IO is too long so default to showing truncated text
  const [displayFullText, setDisplayFullText] = useState(false);
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  const [searchParams] = useSearchParams();
  const [baselineExperimentId = undefined, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  const navigate = useNavigate();
  return (
    <main
      css={css`
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      `}
    >
      <View
        padding="size-200"
        borderBottomColor="dark"
        borderBottomWidth="thin"
        flex="none"
      >
        <Flex direction="row" justifyContent="space-between" alignItems="end">
          <ExperimentMultiSelector
            dataRef={loaderData}
            selectedBaselineExperimentId={baselineExperimentId}
            selectedCompareExperimentIds={compareExperimentIds}
            onChange={(newBaselineExperimentId, newCompareExperimentIds) => {
              startTransition(() => {
                if (newBaselineExperimentId == null) {
                  navigate(`/datasets/${datasetId}/compare`);
                } else {
                  const queryParams = `?${[
                    newBaselineExperimentId,
                    ...newCompareExperimentIds,
                  ]
                    .map((id) => `experimentId=${id}`)
                    .join("&")}`;
                  navigate(`/datasets/${datasetId}/compare${queryParams}`);
                }
              });
            }}
          />
          <Switch
            onChange={(isSelected) => {
              setDisplayFullText(isSelected);
            }}
            defaultSelected={false}
            labelPlacement="start"
          >
            Full Text
          </Switch>
        </Flex>
      </View>
      {baselineExperimentId != null ? (
        <ExperimentRunFilterConditionProvider>
          <Suspense fallback={<Loading />}>
            <ExperimentCompareTable
              query={loaderData}
              datasetId={datasetId}
              baselineExperimentId={baselineExperimentId}
              compareExperimentIds={compareExperimentIds}
              displayFullText={displayFullText}
            />
          </Suspense>
        </ExperimentRunFilterConditionProvider>
      ) : (
        <View padding="size-200">
          <Alert variant="info" title="No Baseline Experiment Selected">
            Please select a baseline experiment.
          </Alert>
        </View>
      )}
    </main>
  );
}
