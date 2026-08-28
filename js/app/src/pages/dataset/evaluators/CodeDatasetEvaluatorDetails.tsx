import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";
import invariant from "tiny-invariant";

import { Card, Empty, Flex } from "@phoenix/components";
import { CodeEvaluatorSandboxCard } from "@phoenix/components/evaluators/CodeEvaluatorSandboxCard";
import { CodeEvaluatorSourceCodeBlock } from "@phoenix/components/evaluators/CodeEvaluatorSourceCodeBlock";
import { EvaluatorAnnotationsCard } from "@phoenix/components/evaluators/EvaluatorAnnotationsCard";
import {
  evaluatorSplitContainerCSS,
  evaluatorSplitLayoutCSS,
} from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { EvaluatorInputMappingCard } from "@phoenix/components/evaluators/EvaluatorInputMappingCard";
import type { CodeDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/CodeDatasetEvaluatorDetails_datasetEvaluator.graphql";
import { LanguageWithIcon } from "@phoenix/pages/settings/sandboxes/utils";

export function CodeDatasetEvaluatorDetails({
  datasetEvaluatorRef,
}: {
  datasetEvaluatorRef: CodeDatasetEvaluatorDetails_datasetEvaluator$key;
}) {
  const datasetEvaluator = useFragment(
    graphql`
      fragment CodeDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {
        inputMapping {
          literalMapping
          pathMapping
        }
        outputConfigs {
          __typename
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
          ... on FreeformAnnotationConfig {
            name
            optimizationDirection
            threshold
          }
        }
        evaluator {
          kind
          ... on CodeEvaluator {
            language
            outputConfigs {
              __typename
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
              ... on FreeformAnnotationConfig {
                name
                optimizationDirection
                threshold
              }
            }
            sandboxConfig {
              ...CodeEvaluatorSandboxCard_sandboxConfig
            }
            currentVersion {
              sourceCode
            }
          }
        }
      }
    `,
    datasetEvaluatorRef
  );

  const evaluator = datasetEvaluator.evaluator;
  if (evaluator.kind !== "CODE") {
    throw new Error("Invalid evaluator for CodeDatasetEvaluatorDetails");
  }
  const currentVersion = evaluator.currentVersion;

  const outputConfigs =
    datasetEvaluator.outputConfigs.length > 0
      ? datasetEvaluator.outputConfigs
      : (evaluator.outputConfigs ?? []);

  // currentVersion can be null (e.g. fixtures, backfills) — render an
  // empty state rather than throwing.
  if (!currentVersion || !currentVersion.sourceCode) {
    return (
      <Flex flex={1} alignItems="center" justifyContent="center">
        <Empty message="This code evaluator has no current version yet." />
      </Flex>
    );
  }
  invariant(evaluator.language, "code evaluator language is required");

  return (
    <div css={evaluatorSplitContainerCSS}>
      <div css={evaluatorSplitLayoutCSS}>
        <Flex direction="column" gap="size-200" minWidth={0}>
          <Card
            title="Source Code"
            extra={<LanguageWithIcon language={evaluator.language} />}
          >
            <CodeEvaluatorSourceCodeBlock
              language={evaluator.language}
              sourceCode={currentVersion.sourceCode}
            />
          </Card>
        </Flex>
        <Flex direction="column" gap="size-200" minWidth={0}>
          <CodeEvaluatorSandboxCard
            sandboxConfigRef={evaluator.sandboxConfig}
          />
          <EvaluatorAnnotationsCard
            outputConfigs={outputConfigs}
            singularTitle="Evaluator Annotation"
            pluralTitle="Evaluator Annotations"
          />
          <EvaluatorInputMappingCard
            inputMapping={datasetEvaluator.inputMapping}
            pathMappingDescription="Map function args to fields on the example"
          />
        </Flex>
      </div>
    </div>
  );
}
