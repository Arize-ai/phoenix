import React from "react";
import { css } from "@emotion/react";

import { Alert, Form } from "@arizeai/components";

import { ConnectedDimensionPicker } from "@phoenix/components/form";
import { ColoringStrategy } from "@phoenix/constants/pointCloudConstants";
import { useDatasets } from "@phoenix/contexts";
import { usePointCloudContext } from "@phoenix/contexts";

import { Loading } from "../Loading";

import { ColoringStrategyPicker } from "./ColoringStrategyPicker";
import { DatasetVisibilitySettings } from "./DatasetVisibilitySettings";
import { PointGroupVisibilitySettings } from "./PointGroupVisibilitySettings";

export function PointCloudDisplaySettings() {
  const { referenceDataset } = useDatasets();
  const coloringStrategy = usePointCloudContext(
    (state) => state.coloringStrategy,
  );
  const setColoringStrategy = usePointCloudContext(
    (state) => state.setColoringStrategy,
  );
  const dimension = usePointCloudContext((state) => state.dimension);
  const dimensionMetadata = usePointCloudContext(
    (state) => state.dimensionMetadata,
  );
  const setDimension = usePointCloudContext((state) => state.setDimension);

  const showDatasetVisibilitySettings = referenceDataset != null;

  const isAwaitingDimensionSelection =
    coloringStrategy === ColoringStrategy.dimension && dimension == null;
  const isAwaitingDimensionMetadataRetrieval =
    coloringStrategy === ColoringStrategy.dimension &&
    dimension != null &&
    dimensionMetadata == null;

  // Show the point group visibility settings if the strategy is not dataset.
  const showPointGroupVisibilitySettings =
    coloringStrategy !== ColoringStrategy.dataset &&
    !isAwaitingDimensionSelection &&
    !isAwaitingDimensionMetadataRetrieval;

  return (
    <section
      css={css`
        & > .ac-form {
          padding: var(--px-spacing-med) var(--px-spacing-med) 0
            var(--px-spacing-med);
        }
        & > .ac-alert {
          margin: var(--px-spacing-med);
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

      {showDatasetVisibilitySettings ? <DatasetVisibilitySettings /> : null}
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
            padding: var(--px-spacing-med);
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
