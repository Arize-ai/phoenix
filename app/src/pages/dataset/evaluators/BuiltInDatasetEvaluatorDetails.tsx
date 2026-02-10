import { ReactNode } from "react";
import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { ContainsEvaluatorCodeBlock } from "@phoenix/components/evaluators/ContainsEvaluatorCodeBlock";
import { ContainsEvaluatorDetails } from "@phoenix/components/evaluators/ContainsEvaluatorDetails";
import { ExactMatchEvaluatorCodeBlock } from "@phoenix/components/evaluators/ExactMatchEvaluatorCodeBlock";
import { ExactMatchEvaluatorDetails } from "@phoenix/components/evaluators/ExactMatchEvaluatorDetails";
import { JSONDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/JSONDistanceEvaluatorCodeBlock";
import { JSONDistanceEvaluatorDetails } from "@phoenix/components/evaluators/JSONDistanceEvaluatorDetails";
import { LevenshteinDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/LevenshteinDistanceEvaluatorCodeBlock";
import { LevenshteinDistanceEvaluatorDetails } from "@phoenix/components/evaluators/LevenshteinDistanceEvaluatorDetails";
import { RegexEvaluatorCodeBlock } from "@phoenix/components/evaluators/RegexEvaluatorCodeBlock";
import { RegexEvaluatorDetails } from "@phoenix/components/evaluators/RegexEvaluatorDetails";
import { BuiltInDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/BuiltInDatasetEvaluatorDetails_datasetEvaluator.graphql";

const boxCSS = css`
  background-color: var(--ac-global-background-color-dark);
  border-radius: var(--ac-global-rounding-medium);
  padding: var(--ac-global-dimension-static-size-200);
  margin-top: var(--ac-global-dimension-static-size-50);
  border: 1px solid var(--ac-global-border-color-default);
`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>{title}</Heading>
      <div css={boxCSS}>{children}</div>
    </Flex>
  );
}

type OutputConfig = {
  name: string;
  optimizationDirection?: string | null;
  values?: Array<{ label?: string | null; score?: number | null }> | null;
  lowerBound?: number | null;
  upperBound?: number | null;
};

function OutputConfigCard({ config }: { config: OutputConfig }) {
  const isCategorical = config.values != null;
  const direction = config.optimizationDirection
    ? config.optimizationDirection.charAt(0).toUpperCase() +
      config.optimizationDirection.slice(1).toLowerCase()
    : null;

  return (
    <div css={boxCSS}>
      <Flex direction="column" gap="size-100">
        <Text size="S">
          <Text weight="heavy">Name:</Text> {config.name}
        </Text>
        {direction && (
          <Text size="S">
            <Text weight="heavy">Optimization Direction:</Text> {direction}
          </Text>
        )}
        {isCategorical && config.values && config.values.length > 0 && (
          <Text size="S">
            <Text weight="heavy">Values:</Text>{" "}
            {config.values
              .map((v) => `${v.label}${v.score != null ? ` (${v.score})` : ""}`)
              .join(", ")}
          </Text>
        )}
        {!isCategorical && (
          <>
            <Text size="S">
              <Text weight="heavy">Lower Bound:</Text>{" "}
              {config.lowerBound != null
                ? String(config.lowerBound)
                : "Unbounded"}
            </Text>
            <Text size="S">
              <Text weight="heavy">Upper Bound:</Text>{" "}
              {config.upperBound != null
                ? String(config.upperBound)
                : "Unbounded"}
            </Text>
          </>
        )}
      </Flex>
    </div>
  );
}

function OutputConfigsSection({
  configs,
}: {
  configs: readonly OutputConfig[];
}) {
  if (configs.length === 0) return null;

  const title =
    configs.length === 1
      ? "Evaluator Annotation"
      : `Evaluator Annotations (${configs.length})`;

  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>{title}</Heading>
      {configs.map((config, idx) => (
        <OutputConfigCard key={config.name || idx} config={config} />
      ))}
    </Flex>
  );
}

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
  const { revalidate } = useRevalidator();
  const datasetEvaluator = useFragment(
    graphql`
      fragment BuiltInDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {
        id
        inputMapping {
          literalMapping
          pathMapping
        }
        outputConfigs {
          ... on CategoricalAnnotationConfig {
            name
            optimizationDirection
            values {
              label
              score
            }
          }
          ... on ContinuousAnnotationConfig {
            name
            optimizationDirection
            lowerBound
            upperBound
          }
        }
        evaluator {
          kind
          name
          ... on BuiltInEvaluator {
            outputConfigs {
              ... on CategoricalAnnotationConfig {
                name
                optimizationDirection
                values {
                  label
                  score
                }
              }
              ... on ContinuousAnnotationConfig {
                name
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

  const evaluator = datasetEvaluator.evaluator;
  if (evaluator.kind !== "BUILTIN" || !evaluator.name) {
    throw new Error("Invalid evaluator for BuiltInDatasetEvaluatorDetails");
  }

  // Prefer overridden values from datasetEvaluator, fall back to evaluator defaults
  // Merge the configs: if datasetEvaluator has configs, use those; otherwise use evaluator defaults
  const outputConfigs = (
    datasetEvaluator.outputConfigs && datasetEvaluator.outputConfigs.length > 0
      ? datasetEvaluator.outputConfigs
      : (evaluator.outputConfigs ?? [])
  ) as readonly OutputConfig[];
  const inputMapping = datasetEvaluator.inputMapping;
  const name = evaluator.name.toLowerCase();

  let DetailsComponent: React.ComponentType<{
    inputMapping: typeof inputMapping;
  }>;
  let CodeBlockComponent: React.ComponentType;

  switch (name) {
    case "contains":
      DetailsComponent = ContainsEvaluatorDetails;
      CodeBlockComponent = ContainsEvaluatorCodeBlock;
      break;
    case "exact_match":
      DetailsComponent = ExactMatchEvaluatorDetails;
      CodeBlockComponent = ExactMatchEvaluatorCodeBlock;
      break;
    case "regex":
      DetailsComponent = RegexEvaluatorDetails;
      CodeBlockComponent = RegexEvaluatorCodeBlock;
      break;
    case "levenshtein_distance":
      DetailsComponent = LevenshteinDistanceEvaluatorDetails;
      CodeBlockComponent = LevenshteinDistanceEvaluatorCodeBlock;
      break;
    case "json_distance":
      DetailsComponent = JSONDistanceEvaluatorDetails;
      CodeBlockComponent = JSONDistanceEvaluatorCodeBlock;
      break;
    default:
      throw new Error(`Unknown built-in evaluator: ${evaluator.name}`);
  }

  return (
    <>
      <View padding="size-200" overflow="auto" maxWidth={1000}>
        <Flex direction="column" gap="size-200">
          <Section title="Input Mapping">
            <DetailsComponent inputMapping={inputMapping} />
          </Section>
          <OutputConfigsSection configs={outputConfigs} />
          <CodeBlockComponent />
        </Flex>
      </View>
      <EditBuiltInDatasetEvaluatorSlideover
        datasetEvaluatorId={datasetEvaluator.id}
        datasetId={datasetId}
        isOpen={isEditSlideoverOpen}
        onOpenChange={onEditSlideoverOpenChange}
        onUpdate={() => revalidate()}
      />
    </>
  );
}
