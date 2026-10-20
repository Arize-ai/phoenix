/**
 * Parsing for the provisional `metadata.decision` payload that decision
 * evaluators write onto ordinary experiment-run annotations. All parsing of
 * that format lives here; unknown or malformed input yields `null`.
 */

export type DecisionAnnotationStatus = "answered" | "refused" | "error";

/** A scale level as the judge asked it; probabilities index levels by position. */
export type DecisionScaleLevel = { label: string; description: string | null };

export type DecisionAnnotationSummary = {
  status: DecisionAnnotationStatus;
  question: {
    name: string;
    type: string;
    /** A scale's levels, in order; null for other types and older annotations */
    levels: DecisionScaleLevel[] | null;
  } | null;
  /** Confidence for choice/scale answers, when present */
  confidence: number | null;
  /** Probability of "true" for predicate answers, when present */
  probability: number | null;
  /** Expected level for scale answers, when present */
  expectedLevel: number | null;
  /** Probability by choice/level, when present */
  probabilities: { key: string; probability: number }[];
  projection: unknown;
  requestedModel: string | null;
  resolvedModel: string | null;
  provider: string | null;
  customProviderId: string | null;
  source: string | null;
};

export const DECISION_REFUSAL_EXPLANATION =
  "Decision model refused this question.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

function parseLevels(value: unknown): DecisionScaleLevel[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((level) => ({
    label: (isRecord(level) && asString(level.label)) || "",
    description: (isRecord(level) && asString(level.description)) || null,
  }));
}

function parseProbabilities(
  value: unknown
): { key: string; probability: number }[] {
  if (!isRecord(value)) return [];
  const result: { key: string; probability: number }[] = [];
  for (const [key, raw] of Object.entries(value)) {
    const probability = asNumber(raw);
    if (probability != null) result.push({ key, probability });
  }
  return result;
}

/**
 * Parses an annotation's metadata into a decision summary, or null when the
 * annotation is not a (recognizable) decision annotation.
 */
export function parseDecisionAnnotationMetadata(
  metadata: unknown
): DecisionAnnotationSummary | null {
  if (!isRecord(metadata)) return null;
  const decision = metadata.decision;
  if (!isRecord(decision)) return null;
  const status = decision.status;
  if (status !== "answered" && status !== "refused" && status !== "error") {
    return null;
  }
  const question = isRecord(decision.question)
    ? {
        name: asString(decision.question.name) ?? "",
        type: asString(decision.question.type) ?? "",
        levels: parseLevels(decision.question.levels),
      }
    : null;
  const answer = isRecord(decision.answer) ? decision.answer : {};
  return {
    status,
    question,
    confidence: asNumber(answer.confidence),
    probability: asNumber(answer.probability),
    expectedLevel: asNumber(answer.expected_level),
    probabilities: parseProbabilities(answer.probabilities),
    projection: decision.projection ?? null,
    requestedModel: asString(decision.requested_model),
    resolvedModel: asString(decision.resolved_model),
    provider: asString(decision.provider),
    customProviderId: asString(decision.custom_provider_id),
    source: asString(decision.source),
  };
}

/**
 * How to name a scale level's probability: its label, or its description when
 * the label is only the level's number, or the number for older annotations
 * that didn't store levels.
 */
export function describeScaleLevel(
  key: string,
  levels: DecisionScaleLevel[] | null
): { name: string; title: string } {
  const level = levels?.[Number(key)];
  if (!level) return { name: `level ${key}`, title: `level ${key}` };
  const name =
    level.label && level.label !== key
      ? level.label
      : (level.description ?? `level ${key}`);
  const title = [`level ${key}`, level.label, level.description]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(": ");
  return { name, title };
}

export function isRefusedDecisionAnnotation(annotation: {
  metadata?: unknown;
}): boolean {
  return (
    parseDecisionAnnotationMetadata(annotation.metadata)?.status === "refused"
  );
}

/**
 * Counts answered/refused/error decision annotations in a list. Annotations
 * without decision metadata are ignored.
 */
export function countDecisionStatuses(
  annotations: readonly { metadata?: unknown }[]
): Record<DecisionAnnotationStatus, number> {
  const counts = { answered: 0, refused: 0, error: 0 };
  for (const annotation of annotations) {
    const summary = parseDecisionAnnotationMetadata(annotation.metadata);
    if (summary) counts[summary.status] += 1;
  }
  return counts;
}
