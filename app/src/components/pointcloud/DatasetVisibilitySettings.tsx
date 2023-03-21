import React, { ChangeEvent, useCallback, useMemo } from "react";
import { css } from "@emotion/react";

import { usePointCloudContext } from "@phoenix/contexts";
import { ColoringStrategy } from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

import { DEFAULT_COLOR_SCHEME, FALLBACK_COLOR } from "./constants";
import { Shape } from "./ShapeIcon";
import { VisibilityCheckboxField } from "./VisibilityCheckboxField";

/**
 * Small checkbox form that controls the visibility of each dataset.
 */
export function DatasetVisibilitySettings() {
  const { datasetVisibility, setDatasetVisibility, coloringStrategy } =
    usePointCloudContext((state) => ({
      datasetVisibility: state.datasetVisibility,
      setDatasetVisibility: state.setDatasetVisibility,
      coloringStrategy: state.coloringStrategy,
    }));

  const handleDatasetVisibilityChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = event.target;
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
      case ColoringStrategy.dimension:
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
      case ColoringStrategy.dimension:
        return FALLBACK_COLOR;
      default:
        assertUnreachable(coloringStrategy);
    }
  }, [coloringStrategy]);

  const referenceShape =
    coloringStrategy === ColoringStrategy.dataset ? Shape.circle : Shape.square;

  return (
    <form
      css={css`
        display: flex;
        flex-direction: column;
        padding: var(--px-spacing-med);
      `}
    >
      <VisibilityCheckboxField
        checked={datasetVisibility.primary}
        name="primary"
        color={primaryColor}
        onChange={handleDatasetVisibilityChange}
      />
      <VisibilityCheckboxField
        checked={datasetVisibility.reference}
        name="reference"
        onChange={handleDatasetVisibilityChange}
        color={referenceColor}
        iconShape={referenceShape}
      />
    </form>
  );
}
