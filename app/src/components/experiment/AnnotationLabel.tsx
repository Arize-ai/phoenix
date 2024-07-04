import React from "react";
import { css } from "@emotion/react";

import {
  Flex,
  HelpTooltip,
  Icon,
  Icons,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@arizeai/components";

import { floatFormatter, formatFloat } from "@phoenix/utils/numberFormatUtils";

import { AnnotationColorSwatch } from "./AnnotationColorSwatch";

interface Annotation {
  name: string;
  label?: string | null;
  score?: number | null;
  explanation?: string | null;
  annotatorKind: string;
  trace: {
    traceId: string;
    projectId: string;
  } | null;
}

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
export function AnnotationLabel({
  annotation,
  onClick,
}: {
  annotation: Annotation;
  onClick?: () => void;
}) {
  const clickable = typeof onClick == "function";
  const labelValue =
    (typeof annotation.score == "number" && formatFloat(annotation.score)) ||
    annotation.label ||
    "n/a";

  return (
    <TooltipTrigger delay={500} offset={3}>
      <TriggerWrap>
        <div
          role="button"
          css={css`
            cursor: pointer;
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
          aria-label="Click to view the annotation trace"
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
      </TriggerWrap>
      <HelpTooltip>
        <Text weight="heavy" color="inherit" textSize="large" elementType="h3">
          {annotation.name}
        </Text>
        <View paddingTop="size-50" minWidth="150px">
          <Flex direction="row" justifyContent="space-between">
            <Text weight="heavy" color="inherit">
              score
            </Text>
            <Text color="inherit">{floatFormatter(annotation.score)}</Text>
          </Flex>
          <Flex direction="row" justifyContent="space-between">
            <Text weight="heavy" color="inherit">
              label
            </Text>
            <Text color="inherit">{annotation.label || "--"}</Text>
          </Flex>
          <Flex direction="row" justifyContent="space-between">
            <Text weight="heavy" color="inherit">
              kind
            </Text>
            <Text color="inherit">{annotation.annotatorKind}</Text>
          </Flex>
        </View>
        {annotation.explanation ? (
          <View paddingTop="size-50">
            <Flex direction="column">
              <Text weight="heavy" color="inherit">
                explanation
              </Text>
              <View maxHeight="300px" overflow="auto">
                <Text color="inherit">{annotation.explanation}</Text>
              </View>
            </Flex>
          </View>
        ) : null}
        {annotation.trace && clickable ? (
          <View paddingTop="size-100">
            <div
              css={css`
                display: flex;
                flex-direction: row;
                align-items: center;
                color: var(--ac-global-color-primary);
                gap: var(--ac-global-dimension-size-50);
              `}
            >
              <Icon svg={<Icons.InfoOutline />} />
              <span>Click to view evaluator trace</span>
            </div>
          </View>
        ) : null}
      </HelpTooltip>
    </TooltipTrigger>
  );
}
