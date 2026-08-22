import type { Completion, CompletionSection } from "@codemirror/autocomplete";

import type {
  MaterializedEvaluatorContext,
  MaterializedEvaluatorContextEntry,
} from "@phoenix/components/evaluators/evaluatorContext";
import type { EvaluatorPathMember } from "@phoenix/components/evaluators/evaluatorPathCompletions";
import {
  getEvaluatorPathMembers,
  resolveEvaluatorPath,
  toMemberPreview,
} from "@phoenix/components/evaluators/evaluatorPathCompletions";

/** The three inputs every evaluator receives, in slot order. */
export const EVALUATOR_INPUT_SECTION: CompletionSection = {
  name: "Evaluator input",
  rank: 1,
};

/** The record's own names, under the vocabulary of the record kind. */
export const RECORD_SECTION_BY_GRAIN: Record<
  MaterializedEvaluatorContext["grain"],
  CompletionSection
> = {
  span: { name: "From the span", rank: 2 },
  session: { name: "From the session", rank: 2 },
};

/** A slot no mapping fills in; its row is dimmed rather than dropped. */
export const UNSET_COMPLETION_TYPE = "evaluator-completion-unset";

/** A row whose detail reads as prose rather than as a value. */
export const HINT_COMPLETION_TYPE = "evaluator-completion-hint";

const CLASS_BY_COMPLETION_TYPE: Record<string, string> = {
  [UNSET_COMPLETION_TYPE]: "typeahead-completion--unset",
  [HINT_COMPLETION_TYPE]: "typeahead-completion--hint",
};

/** The row class the shared typeahead chrome styles a completion with. */
export function toEvaluatorCompletionClass(completion: Completion): string {
  return completion.type === undefined
    ? ""
    : (CLASS_BY_COMPLETION_TYPE[completion.type] ?? "");
}

export function toEvaluatorInputCompletion({
  entry,
  evaluationContext,
  index,
}: {
  entry: MaterializedEvaluatorContextEntry;
  evaluationContext: MaterializedEvaluatorContext;
  index: number;
}): Completion {
  return {
    label: entry.name,
    type: entry.status === "unset" ? UNSET_COMPLETION_TYPE : "variable",
    detail: getEvaluatorInputDetail({ entry, evaluationContext }),
    info: getEvaluatorInputInfo({ entry, evaluationContext }),
    section: EVALUATOR_INPUT_SECTION,
    boost: 100 - index,
  };
}

export function toRecordVariableCompletion({
  entry,
  evaluationContext,
  index,
}: {
  entry: MaterializedEvaluatorContextEntry;
  evaluationContext: MaterializedEvaluatorContext;
  index: number;
}): Completion {
  const preview =
    entry.status === "resolved" && evaluationContext.hasSampledRecord
      ? toMemberPreview(entry.value)
      : "";
  return {
    label: entry.name,
    type: "variable",
    ...(preview ? { detail: preview } : {}),
    info: getRecordVariableInfo(entry),
    section: RECORD_SECTION_BY_GRAIN[evaluationContext.grain],
    boost: 100 - index,
  };
}

/**
 * The members one step inside `containerPath`, read off the materialized
 * context by the same walk the path field uses.
 */
export function getEvaluatorContextMembers({
  evaluationContext,
  containerPath,
}: {
  evaluationContext: MaterializedEvaluatorContext;
  containerPath: string;
}): EvaluatorPathMember[] {
  const resolution = resolveEvaluatorPath({
    source: evaluationContext.values,
    path: containerPath,
  });
  return resolution.status === "resolved"
    ? getEvaluatorPathMembers(resolution.value, containerPath)
    : [];
}

/** A drill level is headed by the path that reaches it. */
export function toMemberSection(containerPath: string): CompletionSection {
  return { name: containerPath, rank: 1 };
}

/**
 * What a member row shows on the right. Only a sampled record can supply it —
 * the generic skeleton has structure but no values, and a made-up preview
 * would teach the wrong thing.
 */
export function toMemberDetail({
  member,
  evaluationContext,
}: {
  member: EvaluatorPathMember;
  evaluationContext: MaterializedEvaluatorContext;
}): string {
  return evaluationContext.hasSampledRecord
    ? toMemberPreview(member.value)
    : "";
}

function getEvaluatorInputDetail({
  entry,
  evaluationContext,
}: {
  entry: MaterializedEvaluatorContextEntry;
  evaluationContext: MaterializedEvaluatorContext;
}): string {
  if (entry.status === "unset") {
    return "not set";
  }
  const provenance = entry.provenance;
  const origin =
    provenance.kind === "path"
      ? `← ${provenance.path}`
      : provenance.kind === "derived"
        ? `← ${provenance.description}`
        : provenance.kind === "literal"
          ? "literal"
          : "";
  // An evaluator input's origin is what its row has to teach, so it owns the
  // detail column; a value preview beside it only crowds out the path.
  return (
    origin ||
    (entry.status === "resolved" && evaluationContext.hasSampledRecord
      ? toMemberPreview(entry.value)
      : "")
  );
}

function getEvaluatorInputInfo({
  entry,
  evaluationContext,
}: {
  entry: MaterializedEvaluatorContextEntry;
  evaluationContext: MaterializedEvaluatorContext;
}): string {
  if (entry.status === "unset") {
    return "Not set. Set in Evaluator input.";
  }
  if (
    entry.name === "input" &&
    entry.provenance.kind === "path" &&
    entry.provenance.path === evaluationContext.grain
  ) {
    return `Whole ${evaluationContext.grain}. Set in Evaluator input.`;
  }
  if (entry.name === "output") {
    const noun = capitalize(evaluationContext.grain);
    return `${noun} output. Set in Evaluator input.`;
  }
  if (entry.name === "metadata") {
    return "Metadata. Set in Evaluator input.";
  }
  return "Set in Evaluator input.";
}

function getRecordVariableInfo(
  entry: MaterializedEvaluatorContextEntry
): string {
  if (entry.name === "latency_ms") {
    return "Span duration, ms. No setup needed.";
  }
  if (entry.name === "duration_ms") {
    return "Session duration, ms. No setup needed.";
  }
  return entry.description ?? "No setup needed.";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
