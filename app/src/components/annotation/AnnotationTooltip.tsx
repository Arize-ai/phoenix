import React, { ReactNode } from "react";

import {
  Flex,
  HelpTooltip,
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
  extra,
}: {
  annotation: Annotation;
  children: ReactNode;
  extra?: ReactNode;
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
          {annotation.annotatorKind ? (
            <Flex direction="row" justifyContent="space-between">
              <Text weight="heavy" color="inherit">
                annotator kind
              </Text>
              <Text color="inherit">{annotation.annotatorKind}</Text>
            </Flex>
          ) : null}
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
        {extra}
      </HelpTooltip>
    </TooltipTrigger>
  );
}
