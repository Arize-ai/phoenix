import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";

import { Flex } from "@phoenix/components";
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
import type { BuiltInDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/BuiltInDatasetEvaluatorDetails_datasetEvaluator.graphql";

import { OutputConfigsSection, Section } from "./EvaluatorDetailShared";
import type { OutputConfig } from "./EvaluatorDetailShared";

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

  const literalMapping = inputMapping.literalMapping as Record<
    string,
    unknown
  > | null;
  const parseStrings = literalMapping?.parse_strings !== false;

  return (
    <>
      <Flex direction="column" gap="size-200">
        <Section title="Input Mapping">
          <DetailsComponent inputMapping={inputMapping} />
        </Section>
        <OutputConfigsSection configs={outputConfigs} />
        {name === "json_distance" ? (
          <JSONDistanceEvaluatorCodeBlock parseStrings={parseStrings} />
        ) : (
          <CodeBlockComponent />
        )}
      </Flex>
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
