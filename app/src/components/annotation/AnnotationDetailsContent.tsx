import { Flex, Text, View } from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation/AnnotationColorSwatch";
import { JSONText } from "@phoenix/components/code/JSONText";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { AnnotationScoreText } from "./AnnotationScoreText";
import type { Annotation } from "./types";

/**
 * A component that displays the details of a particular annotation
 */
export function AnnotationDetailsContent({
  annotation,
}: {
  annotation: Annotation;
}) {
  return (
    <Flex
      direction="column"
      gap="size-100"
      height="100%"
      justifyContent="space-between"
    >
      <View>
        <Flex direction="row" gap="size-100" alignItems="center">
          <AnnotationColorSwatch annotationName={annotation.name} />
          <Text weight="heavy" color="inherit" size="L" elementType="h3">
            {annotation.name}
          </Text>
        </Flex>
        <View paddingTop="size-100" minWidth="150px">
          <Flex direction="row" justifyContent="space-between">
            <Text weight="heavy" color="inherit">
              label
            </Text>
            <Text color="inherit" title={annotation.label ?? undefined}>
              <Truncate maxWidth="200px">{annotation.label || "--"}</Truncate>
            </Text>
          </Flex>
          <Flex direction="row" justifyContent="space-between">
            <Text weight="heavy" color="inherit">
              score
            </Text>
            <AnnotationScoreText fontFamily="mono">
              {floatFormatter(annotation.score)}
            </AnnotationScoreText>
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
        {annotation.metadata && Object.keys(annotation.metadata).length > 0 ? (
          <View paddingTop="size-50">
            <Flex direction="column">
              <Text weight="heavy" color="inherit">
                metadata
              </Text>
              <View maxHeight="300px" overflow="auto">
                <JSONText json={annotation.metadata} space={2} disableTitle />
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
  );
}
