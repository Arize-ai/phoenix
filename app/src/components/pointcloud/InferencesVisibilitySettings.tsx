import { ChangeEvent, useCallback, useMemo } from "react";
import { css } from "@emotion/react";

import {
  ColoringStrategy,
  FALLBACK_COLOR,
} from "@phoenix/constants/pointCloudConstants";
import { usePointCloudContext } from "@phoenix/contexts";
import { useDefaultColorScheme } from "@phoenix/pages/embedding/useDefaultColorScheme";
import { assertUnreachable } from "@phoenix/typeUtils";

import { Shape } from "./ShapeIcon";
import { VisibilityCheckboxField } from "./VisibilityCheckboxField";

/**
 * Small checkbox form that controls the visibility of each inference set.
 */
export function InferencesVisibilitySettings({
  hasReference,
  hasCorpus,
}: {
  hasReference: boolean;
  hasCorpus: boolean;
}) {
  const inferencesVisibility = usePointCloudContext(
    (state) => state.inferencesVisibility
  );
  const setInferencesVisibility = usePointCloudContext(
    (state) => state.setInferencesVisibility
  );
  const coloringStrategy = usePointCloudContext(
    (state) => state.coloringStrategy
  );

  const handleInferencesVisibilityChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = event.target;
      setInferencesVisibility({
        ...inferencesVisibility,
        [name]: checked,
      });
    },
    [inferencesVisibility, setInferencesVisibility]
  );
  const DEFAULT_COLOR_SCHEME = useDefaultColorScheme();

  const primaryColor = useMemo(() => {
    switch (coloringStrategy) {
      case ColoringStrategy.inferences:
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
      case ColoringStrategy.inferences:
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
    coloringStrategy === ColoringStrategy.inferences
      ? Shape.circle
      : Shape.square;
  const corpusShape =
    coloringStrategy === ColoringStrategy.inferences
      ? Shape.circle
      : Shape.diamond;

  return (
    <form
      css={css`
        display: flex;
        flex-direction: column;
        padding: var(--ac-global-dimension-static-size-100);
      `}
    >
      <VisibilityCheckboxField
        checked={inferencesVisibility.primary}
        name="primary"
        color={primaryColor}
        onChange={handleInferencesVisibilityChange}
      />
      {hasReference ? (
        <VisibilityCheckboxField
          checked={inferencesVisibility.reference}
          name="reference"
          onChange={handleInferencesVisibilityChange}
          color={referenceColor}
          iconShape={referenceShape}
        />
      ) : null}
      {hasCorpus ? (
        <VisibilityCheckboxField
          checked={inferencesVisibility.corpus}
          name="corpus"
          onChange={handleInferencesVisibilityChange}
          color={corpusColor}
          iconShape={corpusShape}
        />
      ) : null}
    </form>
  );
}
