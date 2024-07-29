import React, { ReactNode } from "react";
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

import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { Annotation } from "./types";

/**
 * Wraps a component with a tooltip that displays information about an annotation.
 */
export function AnnotationTooltip({
  annotation,
  children,
}: {
  annotation: Annotation;
  children: ReactNode;
}) {
  return (
    <TooltipTrigger delay={500} offset={3}>
      <TriggerWrap>{children}</TriggerWrap>
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
        {annotation.trace ? (
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
