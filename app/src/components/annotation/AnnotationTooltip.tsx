import { CSSProperties, ReactNode } from "react";

import { HelpTooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Flex, Text, View } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { Annotation } from "./types";

/**
 * Wraps a component with a tooltip that displays information about an annotation.
 */
export function AnnotationTooltip({
  annotation,
  children,
  extra,
  layout = "vertical",
  width,
  leadingExtra,
}: {
  leadingExtra?: ReactNode;
  annotation: Annotation;
  children: ReactNode;
  layout?: "horizontal" | "vertical";
  extra?: ReactNode;
  width?: CSSProperties["width"];
}) {
  return (
    <TooltipTrigger delay={500} offset={3}>
      <TriggerWrap>{children}</TriggerWrap>
      <HelpTooltip UNSAFE_style={{ minWidth: width }}>
        <Flex
          direction={layout === "horizontal" ? "row" : "column"}
          alignItems="start"
        >
          <Flex
            direction="column"
            gap="size-100"
            height="100%"
            justifyContent="space-between"
          >
            {leadingExtra}
            <View>
              <Text weight="heavy" color="inherit" size="L" elementType="h3">
                {annotation.name}
              </Text>
              <View paddingTop="size-100" minWidth="150px">
                <Flex direction="row" justifyContent="space-between">
                  <Text weight="heavy" color="inherit">
                    label
                  </Text>
                  <Text color="inherit" title={annotation.label ?? undefined}>
                    <Truncate maxWidth="200px">
                      {annotation.label || "--"}
                    </Truncate>
                  </Text>
                </Flex>
                <Flex direction="row" justifyContent="space-between">
                  <Text weight="heavy" color="inherit">
                    score
                  </Text>
                  <Text color="inherit">
                    {floatFormatter(annotation.score)}
                  </Text>
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
              {annotation.createdAt ? (
                <Flex
                  direction="row"
                  justifyContent="space-between"
                  wrap="wrap"
                  gap="size-100"
                >
                  <Text weight="heavy" color="inherit">
                    created at
                  </Text>
                  <Text color="inherit">
                    {new Date(annotation.createdAt)
                      .toLocaleString()
                      .split(",")
                      .join(",\n")}
                  </Text>
                </Flex>
              ) : null}
            </View>
          </Flex>
          {extra}
        </Flex>
      </HelpTooltip>
    </TooltipTrigger>
  );
}
