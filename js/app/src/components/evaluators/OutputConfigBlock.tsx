import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Flex, Text } from "@phoenix/components";
import { AnnotationValueList } from "@phoenix/components/annotation/AnnotationValueList";
import { OptimizationDirectionIndicator } from "@phoenix/components/annotation/OptimizationDirectionIndicator";
import type { EvaluatorOptimizationDirection } from "@phoenix/types";

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

/**
 * The categorical values cell spans the whole grid row, since a list of labels
 * does not fit a single column, but stays narrow enough that each label sits
 * close to its score.
 */
const annotationValuesCellCSS = css`
  grid-column: 1 / -1;
  max-width: var(--global-dimension-size-4600);
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

/** Narrows a config's direction to one the indicator can show. */
function toOptimizationDirection(
  direction: string | null | undefined
): EvaluatorOptimizationDirection {
  return direction === "MAXIMIZE" || direction === "MINIMIZE"
    ? direction
    : "NONE";
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
  const direction = toOptimizationDirection(config.optimizationDirection);

  return (
    <div css={annotationGridCSS}>
      <AnnotationCell label="Name" value={config.name} />
      <AnnotationCell label="Type" value={OUTPUT_CONFIG_TYPE_LABELS[type]} />
      <AnnotationCell
        label="Optimization Direction"
        value={
          <OptimizationDirectionIndicator optimizationDirection={direction} />
        }
      />
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
          {/* Only a decision's Yes / No output has one: where good turns bad. */}
          {config.threshold != null && (
            <AnnotationCell
              label="Threshold"
              value={String(config.threshold)}
            />
          )}
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
      {type === "categorical" && (
        <div css={annotationValuesCellCSS}>
          <AnnotationCell
            label="Values"
            value={
              config.values && config.values.length > 0 ? (
                <AnnotationValueList
                  values={config.values}
                  optimizationDirection={direction}
                />
              ) : (
                "—"
              )
            }
          />
        </div>
      )}
    </div>
  );
}
