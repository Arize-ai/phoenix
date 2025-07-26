import { startTransition, useState } from "react";
import {
  useLoaderData,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Switch } from "@arizeai/components";

import { Flex, View } from "@phoenix/components";
import {
  ExperimentCompareLayout,
  ExperimentCompareLayoutSelect,
} from "@phoenix/components/experiment/ExperimentCompareLayoutSelect";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { experimentCompareGridLoader } from "@phoenix/pages/experiment/experimentCompareGridLoader";

import { ExperimentCompareGridPage } from "./ExperimentCompareGridPage";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";

export function ExperimentComparePage() {
  const loaderData = useLoaderData<typeof experimentCompareGridLoader>();
  const showModeSelect = useFeatureFlag("experimentEnhancements");
  const [layout, setLayout] = useState<ExperimentCompareLayout>("grid");
  invariant(loaderData, "loaderData is required");
  // The text of most IO is too long so default to showing truncated text
  const [, setDisplayFullText] = useState(false);
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
          <Flex direction="row" gap="size-100" justifyContent="start">
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
            {showModeSelect && (
              <ExperimentCompareLayoutSelect
                layout={layout}
                onLayoutChange={setLayout}
              />
            )}
          </Flex>
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
      <ExperimentCompareGridPage />
    </main>
  );
}
