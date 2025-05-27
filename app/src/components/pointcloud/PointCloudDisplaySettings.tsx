import { css } from "@emotion/react";

import { Form } from "@arizeai/components";

import { Alert } from "@phoenix/components";
import { ConnectedDimensionPicker } from "@phoenix/components/form";
import { ColoringStrategy } from "@phoenix/constants/pointCloudConstants";
import { useInferences, usePointCloudContext } from "@phoenix/contexts";

import { Loading } from "../loading/Loading";

import { ColoringStrategyPicker } from "./ColoringStrategyPicker";
import { InferencesVisibilitySettings } from "./InferencesVisibilitySettings";
import { PointGroupVisibilitySettings } from "./PointGroupVisibilitySettings";

export function PointCloudDisplaySettings() {
  const { referenceInferences, corpusInferences } = useInferences();
  const coloringStrategy = usePointCloudContext(
    (state) => state.coloringStrategy
  );
  const setColoringStrategy = usePointCloudContext(
    (state) => state.setColoringStrategy
  );
  const dimension = usePointCloudContext((state) => state.dimension);
  const dimensionMetadata = usePointCloudContext(
    (state) => state.dimensionMetadata
  );
  const setDimension = usePointCloudContext((state) => state.setDimension);

  const showInferencesVisibilitySettings =
    referenceInferences != null || corpusInferences != null;

  const isAwaitingDimensionSelection =
    coloringStrategy === ColoringStrategy.dimension && dimension == null;
  const isAwaitingDimensionMetadataRetrieval =
    coloringStrategy === ColoringStrategy.dimension &&
    dimension != null &&
    dimensionMetadata == null;

  // Show the point group visibility settings if the strategy is not inferences.
  const showPointGroupVisibilitySettings =
    coloringStrategy !== ColoringStrategy.inferences &&
    !isAwaitingDimensionSelection &&
    !isAwaitingDimensionMetadataRetrieval;

  return (
    <section
      css={css`
        & > .ac-form {
          padding: var(--ac-global-dimension-static-size-100)
            var(--ac-global-dimension-static-size-100) 0
            var(--ac-global-dimension-static-size-100);
        }
        & > .ac-alert {
          margin: var(--ac-global-dimension-static-size-100);
        }
      `}
    >
      <Form>
        <>
          <ColoringStrategyPicker
            strategy={coloringStrategy}
            onChange={setColoringStrategy}
          />
          {coloringStrategy === ColoringStrategy.dimension ? (
            <ConnectedDimensionPicker
              selectedDimension={null}
              onChange={(dimension) => {
                setDimension(dimension);
              }}
            />
          ) : null}
        </>
      </Form>

      {showInferencesVisibilitySettings ? (
        <InferencesVisibilitySettings
          hasReference={referenceInferences != null}
          hasCorpus={corpusInferences != null}
        />
      ) : null}
      {showPointGroupVisibilitySettings ? (
        <PointGroupVisibilitySettings />
      ) : null}
      {isAwaitingDimensionSelection ? (
        <Alert variant="info" showIcon={false}>
          {"Please select a dimension to color the point cloud by"}
        </Alert>
      ) : null}
      {isAwaitingDimensionMetadataRetrieval ? (
        <div
          css={css`
            padding: var(--ac-global-dimension-static-size-100);
            min-height: 100px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          `}
        >
          <Loading message="Calculating point colors" />
        </div>
      ) : null}
    </section>
  );
}
