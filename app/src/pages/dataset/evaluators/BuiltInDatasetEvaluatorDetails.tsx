import { ComponentType, ReactNode } from "react";
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

// --- Types ---

type OutputConfig = {
  name: string;
  optimizationDirection?: string | null;
  values?: Array<{ label?: string | null; score?: number | null }> | null;
  lowerBound?: number | null;
  upperBound?: number | null;
};

type Mapping = Record<string, unknown> | undefined;

type FieldConfig = {
  label: string;
  pathKey?: string;
  literalKey?: string;
  type?: "boolean" | "string";
  defaultValue?: boolean;
  fallback?: string;
  suffix?: string;
};

type EvaluatorConfig = {
  fields: FieldConfig[];
  CodeBlock: ComponentType;
};

// --- Evaluator configurations ---

const EVALUATOR_CONFIGS: Record<string, EvaluatorConfig> = {
  contains: {
    fields: [
      { label: "Text", pathKey: "text", literalKey: "text" },
      {
        label: "Words",
        pathKey: "words",
        literalKey: "words",
        fallback: "Not set",
      },
      {
        label: "Case sensitive",
        literalKey: "case_sensitive",
        type: "boolean",
      },
      {
        label: "Require all words",
        literalKey: "require_all",
        type: "boolean",
        suffix: "(not implemented!)",
      },
    ],
    CodeBlock: ContainsEvaluatorCodeBlock,
  },
  exactmatch: {
    fields: [
      { label: "Expected", pathKey: "expected", literalKey: "expected" },
      { label: "Actual", pathKey: "actual", literalKey: "actual" },
      {
        label: "Case sensitive",
        literalKey: "case_sensitive",
        type: "boolean",
        defaultValue: true,
      },
    ],
    CodeBlock: ExactMatchEvaluatorCodeBlock,
  },
  regex: {
    fields: [
      { label: "Text", pathKey: "text", literalKey: "text" },
      { label: "Pattern", literalKey: "pattern", fallback: "Not set" },
      { label: "Full match", literalKey: "full_match", type: "boolean" },
    ],
    CodeBlock: RegexEvaluatorCodeBlock,
  },
  levenshteindistance: {
    fields: [
      { label: "Expected", pathKey: "expected", literalKey: "expected" },
      { label: "Actual", pathKey: "actual", literalKey: "actual" },
      {
        label: "Case sensitive",
        literalKey: "case_sensitive",
        type: "boolean",
        defaultValue: true,
      },
    ],
    CodeBlock: LevenshteinDistanceEvaluatorCodeBlock,
  },
  jsondistance: {
    fields: [
      { label: "Expected", pathKey: "expected", literalKey: "expected" },
      { label: "Actual", pathKey: "actual", literalKey: "actual" },
    ],
    CodeBlock: JSONDistanceEvaluatorCodeBlock,
  },
};

// --- Helper functions ---

function formatFieldValue(
  field: FieldConfig,
  path: Mapping,
  literal: Mapping
): string {
  if (field.type === "boolean") {
    const value = literal?.[field.literalKey!] as boolean | string | undefined;
    const bool =
      value === true || value === "true"
        ? true
        : value === false || value === "false"
          ? false
          : (field.defaultValue ?? false);
    return bool ? "Yes" : "No";
  }
  const pathVal = field.pathKey ? (path?.[field.pathKey] as string) : undefined;
  const litVal = field.literalKey
    ? (literal?.[field.literalKey] as string)
    : undefined;
  if (pathVal) return pathVal;
  if (litVal != null) return `"${litVal}"`;
  return field.fallback ?? "Not mapped";
}

function formatOptimizationDirection(direction?: string | null): string {
  if (!direction) return "None";
  return direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase();
}

// --- UI Components ---

const boxCSS = css`
  background-color: var(--ac-global-background-color-dark);
  border-radius: var(--ac-global-rounding-medium);
  padding: var(--ac-global-dimension-static-size-200);
  margin-top: var(--ac-global-dimension-static-size-50);
  border: 1px solid var(--ac-global-border-color-default);
`;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text size="S">
      <Text weight="heavy">{label}:</Text> {value}
    </Text>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>{title}</Heading>
      <div css={boxCSS}>
        <Flex direction="column" gap="size-100">
          {children}
        </Flex>
      </div>
    </Flex>
  );
}

function OutputConfigDisplay({ config }: { config: OutputConfig | null }) {
  if (!config) return null;
  const isCategorical = config.values != null;

  return (
    <Section title="Evaluator Annotation">
      <Row label="Name" value={config.name} />
      {config.optimizationDirection && (
        <Row
          label="Optimization Direction"
          value={formatOptimizationDirection(config.optimizationDirection)}
        />
      )}
      {isCategorical && config.values && config.values.length > 0 && (
        <Text>
          <Text size="S" weight="heavy">
            Values:{" "}
          </Text>
          {config.values.map((v, i, arr) => (
            <Text key={i} size="S">
              {v.label}
              {v.score != null ? ` (${v.score})` : ""}
              {i < arr.length - 1 ? ", " : ""}
            </Text>
          ))}
        </Text>
      )}
      {!isCategorical && (
        <>
          <Row
            label="Lower Bound"
            value={
              config.lowerBound != null
                ? String(config.lowerBound)
                : "Unbounded"
            }
          />
          <Row
            label="Upper Bound"
            value={
              config.upperBound != null
                ? String(config.upperBound)
                : "Unbounded"
            }
          />
        </>
      )}
    </Section>
  );
}

// --- Main component ---

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
  const data = useFragment(
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

  const evaluator = data.evaluator;
  if (evaluator.kind !== "CODE" || !evaluator.isBuiltin || !evaluator.name) {
    throw new Error("Invalid evaluator for BuiltInDatasetEvaluatorDetails");
  }

  const config = EVALUATOR_CONFIGS[evaluator.name.toLowerCase()];
  if (!config) {
    throw new Error(`Unknown built-in evaluator: ${evaluator.name}`);
  }

  const outputConfig = (data.outputConfig ??
    evaluator.outputConfig) as OutputConfig | null;
  const path = data.inputMapping?.pathMapping as Mapping;
  const literal = data.inputMapping?.literalMapping as Mapping;

  return (
    <>
      <View padding="size-200" overflow="auto">
        <Flex direction="column" gap="size-200">
          <Section title="Input Mapping">
            {config.fields.map((field) => {
              const value = formatFieldValue(field, path, literal);
              return (
                <Row
                  key={field.label}
                  label={field.label}
                  value={field.suffix ? `${value} ${field.suffix}` : value}
                />
              );
            })}
          </Section>
          <OutputConfigDisplay config={outputConfig} />
          <config.CodeBlock />
        </Flex>
      </View>
      <EditBuiltInDatasetEvaluatorSlideover
        datasetEvaluatorId={data.id}
        datasetId={datasetId}
        isOpen={isEditSlideoverOpen}
        onOpenChange={onEditSlideoverOpenChange}
        onUpdate={() => revalidate()}
      />
    </>
  );
}
