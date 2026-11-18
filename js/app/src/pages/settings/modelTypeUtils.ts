export type ModelTypeValue = "CHAT" | "DECISION" | "%future added value";

const MODEL_TYPE_LABELS = {
  CHAT: "Chat",
  DECISION: "Decision",
} as const satisfies Record<
  Exclude<ModelTypeValue, "%future added value">,
  string
>;

/**
 * Lists the model types a provider serves, for a table cell.
 * @param modelTypes - the provider's model types, as the server returns them
 * @returns comma-separated labels in a fixed order, or an em dash when none are known
 */
export function formatModelTypes(
  modelTypes: ReadonlyArray<ModelTypeValue>
): string {
  const labels = (["CHAT", "DECISION"] as const)
    .filter((modelType) => modelTypes.includes(modelType))
    .map((modelType) => MODEL_TYPE_LABELS[modelType]);
  return labels.join(", ") || "—";
}
