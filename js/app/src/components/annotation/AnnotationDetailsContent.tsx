import { Flex, Text, View } from "@phoenix/components";
import { AnnotationColorSwatch } from "@phoenix/components/annotation/AnnotationColorSwatch";
import { JSONText } from "@phoenix/components/code/JSONText";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { floatFormatter } from "@phoenix/utils/numberFormatUtils";

import { AnnotationScoreText } from "./AnnotationScoreText";
import {
  type DecisionAnnotationSummary,
  parseDecisionAnnotationMetadata,
} from "./decisionAnnotationMetadata";
import type { Annotation } from "./types";

function DecisionRow({ name, value }: { name: string; value: string }) {
  return (
    <Flex direction="row" justifyContent="space-between" gap="size-100">
      <Text weight="heavy" color="inherit">
        {name}
      </Text>
      <Text color="inherit" fontFamily="mono">
        {value}
      </Text>
    </Flex>
  );
}

/**
 * Status, uncertainty and provenance for a decision evaluator's annotation.
 */
function DecisionDetails({
  decision,
}: {
  decision: DecisionAnnotationSummary;
}) {
  const model = decision.resolvedModel ?? decision.requestedModel;
  return (
    <View paddingTop="size-50" data-testid="decision-details">
      <Flex direction="column">
        <DecisionRow
          name="decision status"
          value={decision.status === "refused" ? "Refused" : decision.status}
        />
        {decision.question ? (
          <DecisionRow
            name="question"
            value={`${decision.question.name} (${decision.question.type})`}
          />
        ) : null}
        {decision.probability != null ? (
          <DecisionRow
            name="probability"
            value={floatFormatter(decision.probability)}
          />
        ) : null}
        {decision.expectedLevel != null ? (
          <DecisionRow
            name="expected level"
            value={floatFormatter(decision.expectedLevel)}
          />
        ) : null}
        {decision.confidence != null ? (
          <DecisionRow
            name="confidence"
            value={floatFormatter(decision.confidence)}
          />
        ) : null}
        {decision.probabilities.map(({ key, probability }) => (
          <DecisionRow
            key={key}
            name={`p(${key})`}
            value={floatFormatter(probability)}
          />
        ))}
        {model ? <DecisionRow name="model" value={model} /> : null}
        {decision.provider ? (
          <DecisionRow name="provider" value={decision.provider} />
        ) : null}
      </Flex>
    </View>
  );
}

/**
 * A component that displays the details of a particular annotation
 */
export function AnnotationDetailsContent({
  annotation,
}: {
  annotation: Annotation;
}) {
  const decision = parseDecisionAnnotationMetadata(annotation.metadata);
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
        {decision ? <DecisionDetails decision={decision} /> : null}
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
