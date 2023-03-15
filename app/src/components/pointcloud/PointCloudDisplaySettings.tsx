import React from "react";
import { css } from "@emotion/react";

import { Form } from "@arizeai/components";

import { useDatasets } from "@phoenix/contexts";
import { usePointCloudContext } from "@phoenix/contexts";
import { ColoringStrategy } from "@phoenix/types";

import { ColoringStrategyPicker } from "./ColoringStrategyPicker";
import { DatasetVisibilitySettings } from "./DatasetVisibilitySettings";
import { PointGroupVisibilitySettings } from "./PointGroupVisibilitySettings";

export function PointCloudDisplaySettings() {
  const { referenceDataset } = useDatasets();
  const [coloringStrategy, setColoringStrategy] = usePointCloudContext(
    (state) => [state.coloringStrategy, state.setColoringStrategy]
  );

  const showDatasetVisibilitySettings = referenceDataset != null;
  // Show the point group visibility settings if the strategy is not dataset.
  const showPointGroupVisibilitySettings =
    coloringStrategy !== ColoringStrategy.dataset;

  return (
    <section
      css={css`
        & > .ac-form {
          padding: var(--px-spacing-med) var(--px-spacing-med) 0
            var(--px-spacing-med);
        }
      `}
    >
      <Form>
        <ColoringStrategyPicker
          strategy={coloringStrategy}
          onChange={setColoringStrategy}
        />
      </Form>

      {showDatasetVisibilitySettings ? <DatasetVisibilitySettings /> : null}
      {showPointGroupVisibilitySettings ? (
        <PointGroupVisibilitySettings />
      ) : null}
    </section>
  );
}
