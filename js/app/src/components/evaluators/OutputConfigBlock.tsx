import { css } from "@emotion/react";
import capitalize from "lodash/capitalize";
import type { ReactNode } from "react";

import { Flex, Text } from "@phoenix/components";

/**
 * The annotation an evaluator writes, in whichever shape its config takes.
 * The shape is discriminated by the config's GraphQL `__typename`; fields are
 * never sniffed, since a legal config (e.g. an unbounded continuous one) can
 * have every optional field unset.
 */
export type OutputConfig = {
  name: string;
  optimizationDirection?: string | null;
  values?: ReadonlyArray<{
    label?: string | null;
    score?: number | null;
  }> | null;
  lowerBound?: number | null;
  upperBound?: number | null;
  threshold?: number | null;
};

type OutputConfigType = "categorical" | "continuous" | "freeform";

const OUTPUT_CONFIG_TYPE_BY_TYPENAME: Record<
  string,
  OutputConfigType | undefined
> = {
  CategoricalAnnotationConfig: "categorical",
  ContinuousAnnotationConfig: "continuous",
  FreeformAnnotationConfig: "freeform",
};

const OUTPUT_CONFIG_TYPE_LABELS: Record<OutputConfigType, string> = {
  categorical: "Categorical",
  continuous: "Continuous",
  freeform: "Freeform",
};

const annotationGridCSS = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--global-dimension-size-200);
`;

/** One label-over-value cell of an evaluator annotation grid. */
function AnnotationCell({ label, value }: { label: string; value: ReactNode }) {
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
  return direction ? capitalize(direction) : "None";
}

function formatCategoricalValues(values: OutputConfig["values"]): string {
  if (!values || values.length === 0) return "—";
  return values
    .map((v) => `${v.label}${v.score != null ? ` (${v.score})` : ""}`)
    .join(", ");
}

function formatBound(value: number | null | undefined): string {
  return value != null ? String(value) : "Unbounded";
}

/**
 * The grid of an annotation config's settings, shared by the evaluator
 * details pages so an annotation reads the same everywhere.
 */
export function OutputConfigBlock({
  config,
  typename,
  includeExplanation,
}: {
  config: OutputConfig;
  /** The config's GraphQL `__typename`, discriminating which shape it takes. */
  typename: string;
  /** When set, renders an Explanations cell reflecting whether the evaluator explains itself. */
  includeExplanation?: boolean;
}) {
  // An unrecognized typename (Relay's `%other`) has no fields selected, so
  // freeform — the shape with the fewest assumptions — is the safe rendering.
  const type = OUTPUT_CONFIG_TYPE_BY_TYPENAME[typename] ?? "freeform";
  const direction = formatOptimizationDirection(config.optimizationDirection);

  return (
    <div css={annotationGridCSS}>
      <AnnotationCell label="Name" value={config.name} />
      <AnnotationCell label="Type" value={OUTPUT_CONFIG_TYPE_LABELS[type]} />
      <AnnotationCell label="Optimization Direction" value={direction} />
      {type === "categorical" && (
        <AnnotationCell
          label="Values"
          value={formatCategoricalValues(config.values)}
        />
      )}
      {type === "continuous" && (
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
      {type === "freeform" && (
        <AnnotationCell
          label="Threshold"
          value={config.threshold != null ? String(config.threshold) : "—"}
        />
      )}
      {includeExplanation != null && (
        <AnnotationCell
          label="Explanations"
          value={includeExplanation ? "Enabled" : "Disabled"}
        />
      )}
    </div>
  );
}
