import { ReactNode } from "react";
import { Pressable } from "react-aria-components";
import { css } from "@emotion/react";

import { Flex } from "@phoenix/components";
import {
  Annotation,
  AnnotationNameAndValue,
} from "@phoenix/components/annotation";

type ProportionBarProps = {
  score?: number | null;
  lowerBound?: number | null;
  upperBound?: number | null;
  optimizationDirection?: "MAXIMIZE" | "MINIMIZE";
};

/**
 * A button that appears like a list item but that is still interactive
 * to show a pop-over for the details
 */
export function ExperimentAnnotationButton({
  annotation,
  extra,
  positiveOptimization,
  score,
  lowerBound,
  upperBound,
  optimizationDirection,
}: {
  annotation: Annotation;
  /**
   * Whether the annotation is a positive or negative optimization
   *
   * If not provided, the component will not display the optimization information.
   */
  positiveOptimization?: boolean;
  /**
   * Additional content like controls that will be placed on the right
   */
  extra?: ReactNode;
} & ProportionBarProps) {
  return (
    <Pressable>
      <button
        className="button--reset"
        css={css`
          container-type: inline-size;
          cursor: pointer;
          padding: var(--ac-global-dimension-size-50)
            var(--ac-global-dimension-size-100);
          flex: 1 1 auto;
          border-radius: var(--ac-global-rounding-small);
          width: 100%;
          min-width: 0;
          &:hover {
            background-color: var(--ac-global-color-grey-200);
          }
        `}
      >
        <Flex
          direction="row"
          gap="size-600"
          alignItems="center"
          justifyContent="space-between"
        >
          <AnnotationNameAndValue
            positiveOptimization={positiveOptimization}
            annotation={annotation}
            displayPreference="score"
            maxWidth="unset"
            showProportionBar
            score={score}
            lowerBound={lowerBound}
            upperBound={upperBound}
            optimizationDirection={optimizationDirection}
          />
          {extra}
        </Flex>
      </button>
    </Pressable>
  );
}
