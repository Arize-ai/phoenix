import React from "react";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text } from "@arizeai/components";

import { assertUnreachable } from "@phoenix/typeUtils";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import { Annotation } from "./types";

type AnnotationDisplay = "label" | "score";

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

const getAnnotationDisplayValue = (
  annotation: Annotation,
  display: AnnotationDisplay
) => {
  switch (display) {
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
    default:
      assertUnreachable(display);
  }
};

export function AnnotationLabel({
  annotation,
  onClick,
  annotationDisplay = "score",
}: {
  annotation: Annotation;
  onClick?: () => void;
  annotationDisplay?: AnnotationDisplay;
}) {
  const clickable = typeof onClick == "function";
  const labelValue = getAnnotationDisplayValue(annotation, annotationDisplay);

  return (
    <div
      role={clickable ? "button" : undefined}
      css={css`
        cursor: ${clickable ? "pointer" : "default"};
        border-radius: var(--ac-global-dimension-size-50);
        border: 1px solid var(--ac-global-color-grey-400);
        padding: var(--ac-global-dimension-size-50)
          var(--ac-global-dimension-size-100);
        transition: background-color 0.2s;
        &:hover {
          background-color: var(--ac-global-color-grey-300);
        }
        .ac-icon-wrap {
          font-size: 12px;
        }
      `}
      aria-label={
        clickable
          ? "Click to view the annotation trace"
          : `Annotation: ${annotation.name}`
      }
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick && onClick();
      }}
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        <AnnotationColorSwatch annotationName={annotation.name} />
        <div css={textCSS}>
          <Text weight="heavy" textSize="small" color="inherit">
            {annotation.name}
          </Text>
        </div>
        <div
          css={css(
            textCSS,
            css`
              margin-left: var(--ac-global-dimension-100);
            `
          )}
        >
          <Text textSize="small">{labelValue}</Text>
        </div>
        {annotation.trace && clickable ? (
          <Icon svg={<Icons.ArrowIosForwardOutline />} />
        ) : null}
      </Flex>
    </div>
  );
}
