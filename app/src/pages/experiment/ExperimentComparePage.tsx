import { startTransition, useCallback, useMemo, useState } from "react";
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
  isExperimentCompareLayout,
} from "@phoenix/components/experiment/ExperimentCompareLayoutSelect";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { experimentCompareLoader } from "@phoenix/pages/experiment/experimentCompareLoader";
import { assertUnreachable } from "@phoenix/typeUtils";

import { ExperimentCompareGridPage } from "./ExperimentCompareGridPage";
import { ExperimentCompareMetricsPage } from "./ExperimentCompareMetricsPage";
import { ExperimentMultiSelector } from "./ExperimentMultiSelector";

export function ExperimentComparePage() {
  const loaderData = useLoaderData<typeof experimentCompareLoader>();
  const showModeSelect = useFeatureFlag("experimentEnhancements");
  invariant(loaderData, "loaderData is required on ExperimentComparePage");
  // The text of most IO is too long so default to showing truncated text
  const [displayFullText, setDisplayFullText] = useState(false);
  const { datasetId } = useParams();
  invariant(datasetId != null, "datasetId is required");
  const [searchParams] = useSearchParams();
  const [baselineExperimentId = undefined, ...compareExperimentIds] =
    searchParams.getAll("experimentId");
  const layout = useMemo(() => {
    const layout = searchParams.get("layout");
    if (isExperimentCompareLayout(layout)) {
      return layout;
    }
    return "grid";
  }, [searchParams]);
  const navigate = useNavigate();

  const onLayoutChange = useCallback(
    (layout: ExperimentCompareLayout) => {
      searchParams.set("layout", layout);
      navigate(`/datasets/${datasetId}/compare?${searchParams.toString()}`);
    },
    [datasetId, navigate, searchParams]
  );

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
                onLayoutChange={onLayoutChange}
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
      <ExperimentComparePageContent
        layout={layout}
        displayFullText={displayFullText}
      />
    </main>
  );
}

type ExperimentComparePageContentProps = {
  layout: ExperimentCompareLayout;
  displayFullText: boolean;
};

function ExperimentComparePageContent({
  layout,
  displayFullText,
}: ExperimentComparePageContentProps) {
  if (layout === "grid") {
    return <ExperimentCompareGridPage displayFullText={displayFullText} />;
  } else if (layout === "metrics") {
    return <ExperimentCompareMetricsPage />;
  }
  assertUnreachable(layout);
}
