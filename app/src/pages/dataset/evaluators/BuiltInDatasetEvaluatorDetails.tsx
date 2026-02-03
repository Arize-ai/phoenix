import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { ContainsEvaluatorCodeBlock } from "@phoenix/components/evaluators/ContainsEvaluatorCodeBlock";
import { ExactMatchEvaluatorCodeBlock } from "@phoenix/components/evaluators/ExactMatchEvaluatorCodeBlock";
import { JSONDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/JSONDistanceEvaluatorCodeBlock";
import { LevenshteinDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/LevenshteinDistanceEvaluatorCodeBlock";
import { RegexEvaluatorCodeBlock } from "@phoenix/components/evaluators/RegexEvaluatorCodeBlock";
import { BuiltInDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/BuiltInDatasetEvaluatorDetails_datasetEvaluator.graphql";

type OutputConfig = {
  name: string;
  optimizationDirection?: string | null;
  // Categorical
  values?: Array<{ label?: string | null; score?: number | null }> | null;
  // Continuous
  lowerBound?: number | null;
  upperBound?: number | null;
};

export function BuiltInDatasetEvaluatorDetails({
  datasetEvaluatorRef,
  datasetId,
  isEditSlideoverOpen,
  onEditSlideoverOpenChange,
}: {
  datasetEvaluatorRef: BuiltInDatasetEvaluatorDetails_datasetEvaluator$key;
  datasetId: string;
  isEditSlideoverOpen: boolean;
  onEditSlideoverOpenChange: (isOpen: boolean) => void;
}) {
  // this is so evaluator name updates are reflected in the breadcrumbs
  const { revalidate } = useRevalidator();
  const datasetEvaluator = useFragment(
    graphql`
      fragment BuiltInDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {
        id
        inputMapping {
          literalMapping
          pathMapping
        }
        outputConfig {
          ... on AnnotationConfigBase {
            name
          }
          ... on CategoricalAnnotationConfig {
            optimizationDirection
            values {
              label
              score
            }
          }
          ... on ContinuousAnnotationConfig {
            optimizationDirection
            lowerBound
            upperBound
          }
        }
        evaluator {
          kind
          name
          isBuiltin
          ... on BuiltInEvaluator {
            outputConfig {
              ... on AnnotationConfigBase {
                name
              }
              ... on CategoricalAnnotationConfig {
                optimizationDirection
                values {
                  label
                  score
                }
              }
              ... on ContinuousAnnotationConfig {
                optimizationDirection
                lowerBound
                upperBound
              }
            }
          }
        }
      }
    `,
    datasetEvaluatorRef
  );

  // Use datasetEvaluator's outputConfig if set, otherwise fall back to evaluator's default
  const outputConfig = (datasetEvaluator.outputConfig ??
    datasetEvaluator.evaluator.outputConfig) as OutputConfig | null;

  const evaluator = datasetEvaluator.evaluator;
  const inputMapping = datasetEvaluator.inputMapping;

  if (evaluator.kind !== "CODE") {
    throw new Error(
      "BuiltInDatasetEvaluatorDetails called for non-CODE evaluator"
    );
  }

  if (evaluator.isBuiltin && evaluator.name) {
    const editSlideover = (
      <EditBuiltInDatasetEvaluatorSlideover
        datasetEvaluatorId={datasetEvaluator.id}
        datasetId={datasetId}
        isOpen={isEditSlideoverOpen}
        onOpenChange={onEditSlideoverOpenChange}
        onUpdate={() => revalidate()}
      />
    );

    switch (evaluator.name.toLowerCase()) {
      case "contains": {
        return (
          <>
            <ContainsEvaluatorDetails
              inputMapping={inputMapping}
              outputConfig={outputConfig}
            />
            {editSlideover}
          </>
        );
      }
      case "exactmatch": {
        return (
          <>
            <ExactMatchEvaluatorDetails
              inputMapping={inputMapping}
              outputConfig={outputConfig}
            />
            {editSlideover}
          </>
        );
      }
      case "regex": {
        return (
          <>
            <RegexEvaluatorDetails
              inputMapping={inputMapping}
              outputConfig={outputConfig}
            />
            {editSlideover}
          </>
        );
      }
      case "levenshteindistance": {
        return (
          <>
            <LevenshteinDistanceEvaluatorDetails
              inputMapping={inputMapping}
              outputConfig={outputConfig}
            />
            {editSlideover}
          </>
        );
      }
      case "jsondistance": {
        return (
          <>
            <JSONDistanceEvaluatorDetails
              inputMapping={inputMapping}
              outputConfig={outputConfig}
            />
            {editSlideover}
          </>
        );
      }
    }
  }

  throw new Error(
    "Unknown built-in evaluator or code evaluator not implemented"
  );
}

const inputMappingBoxCSS = css`
  background-color: var(--ac-global-background-color-dark);
  border-radius: var(--ac-global-rounding-medium);
  padding: var(--ac-global-dimension-static-size-200);
  margin-top: var(--ac-global-dimension-static-size-50);
  border: 1px solid var(--ac-global-border-color-default);
`;

function formatOptimizationDirection(direction?: string | null): string {
  if (!direction) return "None";
  switch (direction.toLowerCase()) {
    case "maximize":
      return "Maximize";
    case "minimize":
      return "Minimize";
    default:
      return direction;
  }
}

function OutputConfigDisplay({
  outputConfig,
}: {
  outputConfig: OutputConfig | null;
}) {
  if (!outputConfig) {
    return null;
  }

  const isCategorical = outputConfig.values != null;

  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>Evaluator Annotation</Heading>
      <div css={inputMappingBoxCSS}>
        <Flex direction="column" gap="size-100">
          <Text size="S">
            <Text weight="heavy">Name:</Text> {outputConfig.name}
          </Text>
          {outputConfig.optimizationDirection && (
            <Text size="S">
              <Text weight="heavy">Optimization Direction:</Text>{" "}
              {formatOptimizationDirection(outputConfig.optimizationDirection)}
            </Text>
          )}
          {isCategorical &&
            outputConfig.values &&
            outputConfig.values.length > 0 && (
              <Text>
                <Text size="S" weight="heavy">
                  Values:{" "}
                </Text>
                {outputConfig.values.map((v, idx, arr) => (
                  <Text key={idx} size="S">
                    {v.label}
                    {v.score != null ? ` (${v.score})` : ""}
                    {idx < arr.length - 1 ? ", " : ""}
                  </Text>
                ))}
              </Text>
            )}
          {!isCategorical && (
            <>
              <Text size="S">
                <Text weight="heavy">Lower Bound:</Text>{" "}
                {outputConfig.lowerBound != null
                  ? outputConfig.lowerBound
                  : "Unbounded"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Upper Bound:</Text>{" "}
                {outputConfig.upperBound != null
                  ? outputConfig.upperBound
                  : "Unbounded"}
              </Text>
            </>
          )}
        </Flex>
      </div>
    </Flex>
  );
}

function ContainsEvaluatorDetails({
  inputMapping,
  outputConfig,
}: {
  inputMapping: {
    literalMapping?: {
      text?: string | null;
      words?: string | null;
      case_sensitive?: boolean | string | null;
      require_all?: boolean | string | null;
    } | null;
    pathMapping?: {
      text?: string | null;
      words?: string | null;
    } | null;
  } | null;
  outputConfig: OutputConfig | null;
}) {
  const textPath = inputMapping?.pathMapping?.text;
  const textLiteral = inputMapping?.literalMapping?.text;
  const wordsPath = inputMapping?.pathMapping?.words;
  const wordsLiteral = inputMapping?.literalMapping?.words;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;
  const requireAll = inputMapping?.literalMapping?.require_all;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Text:</Text>{" "}
                {textPath
                  ? textPath
                  : textLiteral != null
                    ? `"${textLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Words:</Text>{" "}
                {wordsPath
                  ? wordsPath
                  : wordsLiteral
                    ? String(wordsLiteral)
                    : "Not set"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Case sensitive:</Text>{" "}
                {caseSensitive === true || caseSensitive === "true"
                  ? "Yes"
                  : "No"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Require all words:</Text>{" "}
                {requireAll === true || requireAll === "true" ? "Yes" : "No"}{" "}
                (not implemented!)
              </Text>
            </Flex>
          </div>
        </Flex>
        <OutputConfigDisplay outputConfig={outputConfig} />
        <ContainsEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}

function ExactMatchEvaluatorDetails({
  inputMapping,
  outputConfig,
}: {
  inputMapping: {
    literalMapping?: {
      expected?: string | null;
      actual?: string | null;
      case_sensitive?: boolean | string | null;
    } | null;
    pathMapping?: {
      expected?: string | null;
      actual?: string | null;
    } | null;
  } | null;
  outputConfig: OutputConfig | null;
}) {
  const expectedPath = inputMapping?.pathMapping?.expected;
  const expectedLiteral = inputMapping?.literalMapping?.expected;
  const actualPath = inputMapping?.pathMapping?.actual;
  const actualLiteral = inputMapping?.literalMapping?.actual;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Expected:</Text>{" "}
                {expectedPath
                  ? expectedPath
                  : expectedLiteral != null
                    ? `"${expectedLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Actual:</Text>{" "}
                {actualPath
                  ? actualPath
                  : actualLiteral != null
                    ? `"${actualLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Case sensitive:</Text>{" "}
                {caseSensitive === false || caseSensitive === "false"
                  ? "No"
                  : "Yes"}
              </Text>
            </Flex>
          </div>
        </Flex>
        <OutputConfigDisplay outputConfig={outputConfig} />
        <ExactMatchEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}

function RegexEvaluatorDetails({
  inputMapping,
  outputConfig,
}: {
  inputMapping: {
    literalMapping?: {
      text?: string | null;
      pattern?: string | null;
      full_match?: boolean | string | null;
    } | null;
    pathMapping?: {
      text?: string | null;
    } | null;
  } | null;
  outputConfig: OutputConfig | null;
}) {
  const textPath = inputMapping?.pathMapping?.text;
  const textLiteral = inputMapping?.literalMapping?.text;
  const pattern = inputMapping?.literalMapping?.pattern;
  const fullMatch = inputMapping?.literalMapping?.full_match;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Text:</Text>{" "}
                {textPath
                  ? textPath
                  : textLiteral != null
                    ? `"${textLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Pattern:</Text>{" "}
                {pattern ? String(pattern) : "Not set"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Full match:</Text>{" "}
                {fullMatch === true || fullMatch === "true" ? "Yes" : "No"}
              </Text>
            </Flex>
          </div>
        </Flex>
        <OutputConfigDisplay outputConfig={outputConfig} />
        <RegexEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}

function LevenshteinDistanceEvaluatorDetails({
  inputMapping,
  outputConfig,
}: {
  inputMapping: {
    literalMapping?: {
      expected?: string | null;
      actual?: string | null;
      case_sensitive?: boolean | string | null;
    } | null;
    pathMapping?: {
      expected?: string | null;
      actual?: string | null;
    } | null;
  } | null;
  outputConfig: OutputConfig | null;
}) {
  const expectedPath = inputMapping?.pathMapping?.expected;
  const expectedLiteral = inputMapping?.literalMapping?.expected;
  const actualPath = inputMapping?.pathMapping?.actual;
  const actualLiteral = inputMapping?.literalMapping?.actual;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Expected:</Text>{" "}
                {expectedPath
                  ? expectedPath
                  : expectedLiteral != null
                    ? `"${expectedLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Actual:</Text>{" "}
                {actualPath
                  ? actualPath
                  : actualLiteral != null
                    ? `"${actualLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Case sensitive:</Text>{" "}
                {caseSensitive === false || caseSensitive === "false"
                  ? "No"
                  : "Yes"}
              </Text>
            </Flex>
          </div>
        </Flex>
        <OutputConfigDisplay outputConfig={outputConfig} />
        <LevenshteinDistanceEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}

function JSONDistanceEvaluatorDetails({
  inputMapping,
  outputConfig,
}: {
  inputMapping: {
    literalMapping?: {
      expected?: string | null;
      actual?: string | null;
    } | null;
    pathMapping?: {
      expected?: string | null;
      actual?: string | null;
    } | null;
  } | null;
  outputConfig: OutputConfig | null;
}) {
  const expectedPath = inputMapping?.pathMapping?.expected;
  const expectedLiteral = inputMapping?.literalMapping?.expected;
  const actualPath = inputMapping?.pathMapping?.actual;
  const actualLiteral = inputMapping?.literalMapping?.actual;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Expected:</Text>{" "}
                {expectedPath
                  ? expectedPath
                  : expectedLiteral != null
                    ? `"${expectedLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Actual:</Text>{" "}
                {actualPath
                  ? actualPath
                  : actualLiteral != null
                    ? `"${actualLiteral}"`
                    : "Not mapped"}
              </Text>
            </Flex>
          </div>
        </Flex>
        <OutputConfigDisplay outputConfig={outputConfig} />
        <JSONDistanceEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}
