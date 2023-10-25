import React, { ChangeEvent, useCallback, useMemo } from "react";
import { css } from "@emotion/react";

import { FALLBACK_COLOR } from "@phoenix/constants/pointCloudConstants";
import { ColoringStrategy } from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";
import { useDefaultColorScheme } from "@phoenix/pages/embedding/useDefaultColorScheme";
import { assertUnreachable } from "@phoenix/typeUtils";

import { Shape } from "./ShapeIcon";
import { VisibilityCheckboxField } from "./VisibilityCheckboxField";

/**
 * Small checkbox form that controls the visibility of each dataset.
 */
export function DatasetVisibilitySettings({
  hasReference,
  hasCorpus,
}: {
  hasReference: boolean;
  hasCorpus: boolean;
}) {
  const datasetVisibility = usePointCloudContext(
    (state) => state.datasetVisibility
  );
  const setDatasetVisibility = usePointCloudContext(
    (state) => state.setDatasetVisibility
  );
  const coloringStrategy = usePointCloudContext(
    (state) => state.coloringStrategy
  );

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
  const DEFAULT_COLOR_SCHEME = useDefaultColorScheme();

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
  }, [coloringStrategy, DEFAULT_COLOR_SCHEME]);

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
  }, [coloringStrategy, DEFAULT_COLOR_SCHEME]);
  const corpusColor = FALLBACK_COLOR;

  const referenceShape =
    coloringStrategy === ColoringStrategy.dataset ? Shape.circle : Shape.square;
  const corpusShape =
    coloringStrategy === ColoringStrategy.dataset
      ? Shape.circle
      : Shape.diamond;

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
      {hasReference ? (
        <VisibilityCheckboxField
          checked={datasetVisibility.reference}
          name="reference"
          onChange={handleDatasetVisibilityChange}
          color={referenceColor}
          iconShape={referenceShape}
        />
      ) : null}
      {hasCorpus ? (
        <VisibilityCheckboxField
          checked={datasetVisibility.corpus}
          name="corpus"
          onChange={handleDatasetVisibilityChange}
          color={corpusColor}
          iconShape={corpusShape}
        />
      ) : null}
    </form>
  );
}
