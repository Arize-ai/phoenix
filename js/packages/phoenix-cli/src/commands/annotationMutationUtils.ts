import { InvalidArgumentError } from "../exitCodes";

export type AnnotationTargetType = "span" | "trace";
export type AnnotatorKind = "HUMAN" | "LLM" | "CODE";

export interface AnnotationMutationResult {
  id: string;
  targetType: AnnotationTargetType;
  targetId: string;
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
  annotatorKind: AnnotatorKind;
  identifier: string;
}

export interface NormalizedAnnotationInput {
  name: string;
  label: string | null;
  score: number | null;
  explanation: string | null;
  annotatorKind: AnnotatorKind;
  result: {
    label?: string | null;
    score?: number;
    explanation?: string | null;
  };
}

function getTargetIdPlaceholder(targetType: AnnotationTargetType): string {
  return targetType === "span" ? "<span-id>" : "<trace-id>";
}

function getAnnotateUsage(targetType: AnnotationTargetType): string {
  const targetIdPlaceholder = getTargetIdPlaceholder(targetType);
  return [
    `px ${targetType} annotate ${targetIdPlaceholder} --name <name> --label <label>`,
    `px ${targetType} annotate ${targetIdPlaceholder} --name <name> --score <number>`,
    `px ${targetType} annotate ${targetIdPlaceholder} --name <name> --explanation <text>`,
  ].join("\n  ");
}

function trimString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function parseScore(score: string | number): number {
  if (typeof score === "number") {
    return score;
  }
  const trimmedScore = score.trim();
  const numericScore = Number(trimmedScore);
  if (!trimmedScore || !Number.isFinite(numericScore)) {
    throw new Error("invalid score");
  }
  return numericScore;
}

function normalizeAnnotatorKind(
  targetType: AnnotationTargetType,
  annotatorKind: string | undefined
): AnnotatorKind {
  if (annotatorKind === undefined) {
    return "HUMAN";
  }
  const normalizedAnnotatorKind = annotatorKind.trim().toUpperCase();
  if (
    normalizedAnnotatorKind === "HUMAN" ||
    normalizedAnnotatorKind === "LLM" ||
    normalizedAnnotatorKind === "CODE"
  ) {
    return normalizedAnnotatorKind;
  }
  throw new InvalidArgumentError(
    `Invalid value for --annotator-kind: ${annotatorKind}\n  Valid values: HUMAN, LLM, CODE\n  ${getAnnotateUsage(targetType)}`
  );
}

export function normalizeAnnotationInput({
  targetType,
  name,
  label,
  score,
  explanation,
  annotatorKind,
}: {
  targetType: AnnotationTargetType;
  name?: string;
  label?: string;
  score?: string | number;
  explanation?: string;
  annotatorKind?: string;
}): NormalizedAnnotationInput {
  const normalizedName = trimString(name);
  if (!normalizedName) {
    throw new InvalidArgumentError(
      `Missing required flag --name.\n  ${getAnnotateUsage(targetType)}`
    );
  }

  let normalizedScore: number | null;
  if (score === undefined) {
    normalizedScore = null;
  } else {
    try {
      normalizedScore = parseScore(score);
    } catch {
      throw new InvalidArgumentError(
        `Invalid value for --score: ${String(score)}\n  ${getAnnotateUsage(targetType)}`
      );
    }
  }

  const normalizedLabel = trimString(label) ?? null;
  const normalizedExplanation = trimString(explanation) ?? null;
  const normalizedAnnotatorKind = normalizeAnnotatorKind(
    targetType,
    annotatorKind
  );

  const hasResult =
    normalizedLabel !== null ||
    normalizedScore !== null ||
    normalizedExplanation !== null;
  if (!hasResult) {
    throw new InvalidArgumentError(
      `At least one of --label, --score, or --explanation must be provided.\n  ${getAnnotateUsage(targetType)}`
    );
  }

  const result: NormalizedAnnotationInput["result"] = {};
  if (normalizedLabel !== null) {
    result.label = normalizedLabel;
  }
  if (normalizedScore !== null) {
    result.score = normalizedScore;
  }
  if (normalizedExplanation !== null) {
    result.explanation = normalizedExplanation;
  }

  return {
    name: normalizedName,
    label: normalizedLabel,
    score: normalizedScore,
    explanation: normalizedExplanation,
    annotatorKind: normalizedAnnotatorKind,
    result,
  };
}

export function buildAnnotationMutationResult({
  id,
  targetType,
  targetId,
  annotationInput,
}: {
  id: string;
  targetType: AnnotationTargetType;
  targetId: string;
  annotationInput: NormalizedAnnotationInput;
}): AnnotationMutationResult {
  return {
    id,
    targetType,
    targetId,
    name: annotationInput.name,
    label: annotationInput.label,
    score: annotationInput.score,
    explanation: annotationInput.explanation,
    annotatorKind: annotationInput.annotatorKind,
    identifier: "",
  };
}

export function getAnnotationMutationHelpText(
  targetType: AnnotationTargetType
): string {
  const targetIdPlaceholder = getTargetIdPlaceholder(targetType);
  return [
    "",
    "Examples:",
    `  px ${targetType} annotate ${targetIdPlaceholder} --name reviewer --label pass`,
    `  px ${targetType} annotate ${targetIdPlaceholder} --name reviewer --score 0.9 --format raw --no-progress`,
  ].join("\n");
}

export function getResponseErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const errorWithDetail = error as { detail?: unknown };
    if (typeof errorWithDetail.detail === "string") {
      return errorWithDetail.detail;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}
