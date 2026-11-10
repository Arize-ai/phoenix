import type { RecordSourceSelectorProxy } from "relay-runtime";

const ROOT_EVALUATOR_COUNT_FIELDS = [
  "projectEvaluatorCount",
  "datasetEvaluatorCount",
] as const;

/**
 * Copies the evaluator counts a mutation payload selected under `query` onto
 * the store root, where the Evaluators page's tab counts read them. Relay
 * stores a payload's `query` object apart from the root.
 */
export function updateRootEvaluatorCounts(
  store: RecordSourceSelectorProxy,
  mutationFieldName: string
) {
  const payloadQuery = store
    .getRootField(mutationFieldName)
    ?.getLinkedRecord("query");
  if (!payloadQuery) {
    return;
  }
  const root = store.getRoot();
  for (const field of ROOT_EVALUATOR_COUNT_FIELDS) {
    const count = payloadQuery.getValue(field);
    if (typeof count === "number") {
      root.setValue(count, field);
    }
  }
}
