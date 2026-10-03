import { describe, expect, it } from "vitest";

import ExperimentCompareDetailsQueryNode from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";
import ExperimentCompareListPageAggregateDataNode from "@phoenix/pages/experiment/__generated__/ExperimentCompareListPage_aggregateData.graphql";
import ExperimentCompareTableComparisonsNode from "@phoenix/pages/experiment/__generated__/ExperimentCompareTable_comparisons.graphql";

/**
 * Walks a compiled Relay node (reader fragment or request) looking for a
 * field named `outputConfigs`, and returns whether its own selection set
 * directly requests `__typename`.
 *
 * Without `__typename`, the three concrete AnnotationConfig types collapse
 * into one flattened shape on the client, so
 * `datasetEvaluatorUtils.outputConfigToAnnotationConfig`'s `switch
 * (outputConfig.__typename)` can never match a concrete case and every
 * evaluator falls back to being treated as FREEFORM with no usable bounds —
 * which is why experiment-compare scores rendered uncolored for every
 * evaluator type (see phoenix#16687).
 */
function outputConfigsRequestsTypename(node: unknown): boolean | null {
  const visited = new Set<unknown>();

  // Only trust an `outputConfigs` field found underneath a `datasetEvaluators`
  // ancestor: the compiled tree can contain unrelated fields that happen to
  // share the `outputConfigs` name elsewhere.
  function findOutputConfigsFields(
    value: unknown,
    underDatasetEvaluators: boolean
  ): { selections: unknown[] }[] {
    if (value == null || typeof value !== "object" || visited.has(value)) {
      return [];
    }
    visited.add(value);

    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        findOutputConfigsFields(item, underDatasetEvaluators)
      );
    }

    const record = value as Record<string, unknown>;
    const isDatasetEvaluators = record.name === "datasetEvaluators";
    const matches: { selections: unknown[] }[] = [];
    if (
      underDatasetEvaluators &&
      record.name === "outputConfigs" &&
      Array.isArray(record.selections)
    ) {
      matches.push(record as { selections: unknown[] });
    }

    for (const key of Object.keys(record)) {
      matches.push(
        ...findOutputConfigsFields(
          record[key],
          underDatasetEvaluators || isDatasetEvaluators
        )
      );
    }
    return matches;
  }

  const outputConfigsFields = findOutputConfigsFields(node, false);
  if (outputConfigsFields.length === 0) return null;

  return outputConfigsFields.every((field) =>
    field.selections.some(
      (selection) =>
        typeof selection === "object" &&
        selection !== null &&
        (selection as Record<string, unknown>).kind === "ScalarField" &&
        (selection as Record<string, unknown>).name === "__typename"
    )
  );
}

describe("experiment-compare outputConfigs queries request __typename", () => {
  it.each([
    [
      "ExperimentCompareTable_comparisons",
      ExperimentCompareTableComparisonsNode,
    ],
    [
      "ExperimentCompareListPage_aggregateData",
      ExperimentCompareListPageAggregateDataNode,
    ],
    ["ExperimentCompareDetailsQuery", ExperimentCompareDetailsQueryNode],
  ])(
    "%s requests __typename on outputConfigs so concrete annotation config types can be discriminated",
    (_name, node) => {
      const result = outputConfigsRequestsTypename(node);
      expect(result).toBe(true);
    }
  );
});
