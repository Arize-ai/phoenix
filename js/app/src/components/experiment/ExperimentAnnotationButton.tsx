import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Pressable } from "react-aria-components";

import { Flex } from "@phoenix/components";
import type { Annotation } from "@phoenix/components/annotation";
import { AnnotationNameAndValue } from "@phoenix/components/annotation";

/**
 * A button that appears like a list item but that is still interactive
 * to show a pop-over for the details
 */
export function ExperimentAnnotationButton({
  annotation,
  extra,
  optimizationValue,
}: {
  annotation: Annotation;
  /**
   * Signed optimization value from -1 (worst) to 1 (best) that colors the
   * value. If not provided, the value is not colored.
   */
  optimizationValue?: number | null;
  /**
   * Additional content like controls that will be placed on the right
   */
  extra?: ReactNode;
}) {
  return (
    <Pressable>
      <button
        className="button--reset"
        css={css`
          container-type: inline-size;
          cursor: pointer;
          padding: var(--global-dimension-size-50)
            var(--global-dimension-size-100);
          flex: 1 1 auto;
          border-radius: var(--global-rounding-small);
          width: 100%;
          min-width: 0;
          &:hover {
            background-color: var(--global-color-gray-200);
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
            optimizationValue={optimizationValue}
            annotation={annotation}
            displayPreference="score-and-label"
            maxWidth="unset"
            showColorSwatch={false}
          />
          {extra}
        </Flex>
      </button>
    </Pressable>
  );
}
