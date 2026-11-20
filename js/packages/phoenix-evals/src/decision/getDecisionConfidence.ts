/**
 * The decision model spec has no confidence field, but providers that report
 * one (OpenAI, TypeSafe) put it in their provider metadata as
 * `confidence[questionId]`. Returns the confidence for one question, or
 * `undefined` when the provider reports none.
 */
export function getDecisionConfidence({
  providerMetadata,
  questionId,
}: {
  providerMetadata: unknown;
  questionId: string;
}): number | undefined {
  if (typeof providerMetadata !== "object" || providerMetadata === null) {
    return undefined;
  }
  for (const metadata of Object.values(providerMetadata)) {
    const confidence = (metadata as { confidence?: Record<string, unknown> })
      ?.confidence?.[questionId];
    if (typeof confidence === "number") return confidence;
  }
  return undefined;
}
