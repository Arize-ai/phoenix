import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { SizingProps } from "@phoenix/components/types";
import { assertUnreachable } from "@phoenix/typeUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { Annotation } from "./types";

const textCSS = css`
  display: flex;
  align-items: center;
  .ac-text {
    display: inline-block;
    max-width: 9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

type AnnotationDisplayPreference = "label" | "score" | "none";

const getAnnotationDisplayValue = ({
  annotation,
  displayPreference,
}: {
  annotation: Annotation;
  displayPreference: AnnotationDisplayPreference;
}) => {
  switch (displayPreference) {
    case "label":
      return (
        annotation.label ||
        (typeof annotation.score == "number" &&
          formatFloat(annotation.score)) ||
        "n/a"
      );
    case "score":
      return (
        (typeof annotation.score == "number" &&
          formatFloat(annotation.score)) ||
        annotation.label ||
        "n/a"
      );
    case "none":
      return "";
    default:
      assertUnreachable(displayPreference);
  }
};

interface AnnotationNameAndValueProps extends SizingProps {
  annotation: Annotation;
  displayPreference: AnnotationDisplayPreference;
}
export function AnnotationNameAndValue({
  annotation,
  displayPreference,
  size,
}: AnnotationNameAndValueProps) {
  const labelValue = getAnnotationDisplayValue({
    annotation,
    displayPreference,
  });
  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="center"
      className="annotation-name-and-value"
    >
      <AnnotationColorSwatch annotationName={annotation.name} />
      <div css={textCSS}>
        <Text weight="heavy" size={size} color="inherit">
          {annotation.name}
        </Text>
      </div>
      {labelValue && (
        <div
          css={css(
            textCSS,
            css`
              margin-left: var(--ac-global-dimension-100);
            `
          )}
        >
          <Text size={size} fontFamily="mono">
            {labelValue}
          </Text>
        </div>
      )}
    </Flex>
  );
}
