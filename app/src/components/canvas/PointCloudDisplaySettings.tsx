import React, { ChangeEvent, useCallback, useMemo } from "react";
import { css } from "@emotion/react";

import { Form } from "@arizeai/components";

import { useDatasets } from "@phoenix/contexts";
import { usePointCloudStore } from "@phoenix/store";
import { ColoringStrategy } from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import { ColoringStrategyPicker } from "./ColoringStrategyPicker";
import { DEFAULT_COLOR_SCHEME, FALLBACK_COLOR } from "./constants";
import { Shape, ShapeIcon } from "./ShapeIcon";

export function PointCloudDisplaySettings() {
  const { referenceDataset } = useDatasets();
  const [coloringStrategy, setColoringStrategy] = usePointCloudStore(
    (state) => [state.coloringStrategy, state.setColoringStrategy]
  );
  return (
    <section
      css={(theme) =>
        css`
          padding: ${theme.spacing.padding8}px;
        `
      }
    >
      <Form>
        <ColoringStrategyPicker
          strategy={coloringStrategy}
          onChange={setColoringStrategy}
        />
      </Form>
      {}
      {referenceDataset != null ? <DatasetVisibilitySettings /> : null}
    </section>
  );

  function DatasetVisibilitySettings() {
    const { datasetVisibility, setDatasetVisibility, coloringStrategy } =
      usePointCloudStore((state) => ({
        datasetVisibility: state.datasetVisibility,
        setDatasetVisibility: state.setDatasetVisibility,
        coloringStrategy: state.coloringStrategy,
      }));

    const handleDatasetVisibilityChange = useCallback(
      (event: ChangeEvent) => {
        const target = event.target as HTMLInputElement;
        const { name, checked } = target;
        setDatasetVisibility({
          ...datasetVisibility,
          [name]: checked,
        });
      },
      [datasetVisibility, setDatasetVisibility]
    );

    const primaryColor = useMemo(() => {
      switch (coloringStrategy) {
        case ColoringStrategy.dataset:
          return DEFAULT_COLOR_SCHEME[0];
        case ColoringStrategy.correctness:
          return FALLBACK_COLOR;
        default:
          assertUnreachable(coloringStrategy);
      }
    }, [coloringStrategy]);

    const referenceColor = useMemo(() => {
      switch (coloringStrategy) {
        case ColoringStrategy.dataset:
          return DEFAULT_COLOR_SCHEME[1];
        case ColoringStrategy.correctness:
          return FALLBACK_COLOR;
        default:
          assertUnreachable(coloringStrategy);
      }
    }, [coloringStrategy]);

    const referenceShape =
      coloringStrategy === ColoringStrategy.dataset
        ? Shape.circle
        : Shape.square;

    return (
      <form
        css={css`
          display: flex;
          flex-direction: column;
          gap: var(--px-flex-gap-sm);
          label {
            display: flex;
            flex-direction: row;
            gap: var(--px-flex-gap-sm);
            align-items: center;
          }
        `}
      >
        <label>
          <input
            type="checkbox"
            checked={datasetVisibility.primary}
            name="primary"
            onChange={handleDatasetVisibilityChange}
          />
          <ShapeIcon shape={Shape.circle} color={primaryColor} />
          primary dataset
        </label>
        <label>
          <input
            type="checkbox"
            checked={datasetVisibility.reference}
            name="reference"
            onChange={handleDatasetVisibilityChange}
          />
          <ShapeIcon shape={referenceShape} color={referenceColor} />
          reference dataset
        </label>
      </form>
    );
  }
}
