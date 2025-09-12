import { Pressable } from "react-aria-components";
import { css } from "@emotion/react";

import {
  Annotation,
  AnnotationNameAndValue,
} from "@phoenix/components/annotation";
/**
 * A button that appears like a list item but that is still interactive
 * to show a pop-over for the details
 */
export function ExperimentAnnotationButton({
  annotation,
}: {
  annotation: Annotation;
}) {
  return (
    <Pressable>
      <button
        className="button--reset"
        css={css`
          cursor: pointer;
          padding: var(--ac-global-dimension-size-50)
            var(--ac-global-dimension-size-100);
          flex: 1 1 auto;
          border-radius: var(--ac-global-rounding-small);
          width: 100%;
          &:hover {
            background-color: var(--ac-global-color-grey-200);
          }
        `}
      >
        <AnnotationNameAndValue
          annotation={annotation}
          displayPreference="score"
        />
      </button>
    </Pressable>
  );
}
