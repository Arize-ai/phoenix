import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Card, Flex, Text, View } from "@phoenix/components";
import type { DeclaredInputBinding } from "@phoenix/components/evaluators/utils";

const splitLayoutCSS = css`
  display: grid;
  gap: var(--global-dimension-size-200);
  grid-template-columns: minmax(0, 1fr) clamp(300px, 24vw, 380px);
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const annotationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--global-dimension-size-200);
`;

/**
 * The configuration tab of a dataset evaluator: the evaluator's definition
 * (prompt or code) in the main column, its settings in the aside.
 */
export function DatasetEvaluatorDetailsLayout({
  main,
  aside,
}: {
  main: ReactNode;
  aside: ReactNode;
}) {
  return (
    <div css={splitLayoutCSS}>
      <Flex direction="column" gap="size-200" minWidth={0}>
        {main}
      </Flex>
      <Flex direction="column" gap="size-200" minWidth={0}>
        {aside}
      </Flex>
    </div>
  );
}

export type EvaluatorOutputConfig = {
  __typename: string;
  name?: string;
  optimizationDirection?: string | null;
  values?: ReadonlyArray<{
    label?: string | null;
    score?: number | null;
  }> | null;
  lowerBound?: number | null;
  upperBound?: number | null;
  threshold?: number | null;
};

export function AnnotationCell({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <Flex direction="column" gap="size-50">
      <Text size="XS" color="text-700" weight="heavy">
        {label}
      </Text>
      {typeof value === "string" ? <Text>{value}</Text> : value}
    </Flex>
  );
}

function formatOptimizationDirection(direction: string | null | undefined) {
  if (!direction) return "None";
  return direction.charAt(0).toUpperCase() + direction.slice(1).toLowerCase();
}

function formatCategoricalValues(
  values: EvaluatorOutputConfig["values"]
): string {
  if (!values || values.length === 0) return "—";
  return values
    .map((v) => `${v.label}${v.score != null ? ` (${v.score})` : ""}`)
    .join(", ");
}

function formatBound(value: number | null | undefined): string {
  return value != null ? String(value) : "Unbounded";
}

function OutputConfigBlock({
  config,
  sharedCells,
}: {
  config: EvaluatorOutputConfig;
  sharedCells?: ReactNode;
}) {
  const isCategorical = config.__typename === "CategoricalAnnotationConfig";
  const isContinuous = config.__typename === "ContinuousAnnotationConfig";
  const direction = formatOptimizationDirection(config.optimizationDirection);

  return (
    <div css={annotationGridCSS}>
      <AnnotationCell label="Name" value={config.name ?? "—"} />
      <AnnotationCell
        label="Type"
        value={
          isCategorical
            ? "Categorical"
            : isContinuous
              ? "Continuous"
              : "Freeform"
        }
      />
      <AnnotationCell label="Optimization Direction" value={direction} />
      {isCategorical && (
        <AnnotationCell
          label="Values"
          value={formatCategoricalValues(config.values)}
        />
      )}
      {isContinuous && (
        <>
          <AnnotationCell
            label="Lower bound"
            value={formatBound(config.lowerBound)}
          />
          <AnnotationCell
            label="Upper bound"
            value={formatBound(config.upperBound)}
          />
        </>
      )}
      {!isCategorical && !isContinuous && (
        <AnnotationCell
          label="Threshold"
          value={config.threshold != null ? String(config.threshold) : "—"}
        />
      )}
      {sharedCells}
    </div>
  );
}

/**
 * The annotations an evaluator produces. `sharedCells` are settings that
 * apply to every annotation, rendered alongside each one.
 */
export function EvaluatorAnnotationsCard({
  configs,
  sharedCells,
}: {
  configs: ReadonlyArray<EvaluatorOutputConfig>;
  sharedCells?: ReactNode;
}) {
  return (
    <Card
      title={
        configs.length > 1
          ? `Evaluator Annotations (${configs.length})`
          : "Evaluator Annotation"
      }
    >
      <View padding="size-200">
        {configs.length === 0 ? (
          <Text size="S" color="text-500">
            No annotation configured
          </Text>
        ) : (
          <Flex direction="column" gap="size-200">
            {configs.map((config, idx) => (
              <OutputConfigBlock
                key={config.name || idx}
                config={config}
                sharedCells={sharedCells}
              />
            ))}
          </Flex>
        )}
      </View>
    </Card>
  );
}

export function InputMappingCard({ children }: { children: ReactNode }) {
  return (
    <Card title="Input Mapping">
      <View padding="size-200">{children}</View>
    </Card>
  );
}

function formatLiteral(value: boolean | string | number): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

export function DeclaredInputMappingList({
  bindings,
}: {
  bindings: ReadonlyArray<DeclaredInputBinding>;
}) {
  if (bindings.length === 0) {
    return (
      <Text size="S" color="text-500">
        This evaluator takes no inputs
      </Text>
    );
  }
  return (
    <Flex direction="column" gap="size-75">
      {bindings.map((binding) => (
        <Flex
          key={binding.variable}
          direction="row"
          gap="size-100"
          alignItems="baseline"
        >
          <Text size="S" fontFamily="mono" color="text-700">
            {binding.variable}
          </Text>
          <Text size="S" color="text-500" aria-hidden="true">
            →
          </Text>
          {binding.kind === "unmapped" ? (
            <Text size="S" color="text-500">
              Not mapped
            </Text>
          ) : (
            <Text size="S" fontFamily="mono">
              {binding.kind === "path"
                ? binding.path
                : formatLiteral(binding.value)}
            </Text>
          )}
        </Flex>
      ))}
    </Flex>
  );
}
