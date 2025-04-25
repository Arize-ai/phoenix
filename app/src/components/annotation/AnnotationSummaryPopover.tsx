import React, { CSSProperties, ReactNode } from "react";
import { Pressable } from "react-aria";

import {
  Dialog,
  DialogTrigger,
  Flex,
  Popover,
  PopoverArrow,
  Text,
  View,
} from "@phoenix/components";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { Annotation } from "./types";

export function AnnotationSummaryPopover({
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
    <DialogTrigger>
      <Pressable>
        <span role="button">{children}</span>
      </Pressable>
      <Popover style={{ minWidth: width }}>
        <PopoverArrow />
        <Dialog>
          <View padding="size-200">
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
                  <Text
                    weight="heavy"
                    color="inherit"
                    size="L"
                    elementType="h3"
                  >
                    {annotation.name}
                  </Text>
                  <View paddingTop="size-50" minWidth="150px">
                    <Flex direction="row" justifyContent="space-between">
                      <Text weight="heavy" color="inherit">
                        label
                      </Text>
                      <Text color="inherit">{annotation.label || "--"}</Text>
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
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
