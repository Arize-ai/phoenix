import type { Completion, CompletionSection } from "@codemirror/autocomplete";

import type {
  MaterializedEvaluatorContext,
  MaterializedEvaluatorContextEntry,
} from "@phoenix/components/evaluators/evaluatorContext";
import { EVALUATOR_METADATA_SLOT } from "@phoenix/components/evaluators/evaluatorContext";
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

/** A row for a name the selected record does not supply; dimmed, not dropped. */
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

/**
 * One row of the candidate tree: what an author can name at the top level of
 * the evaluation context.
 *
 * `label` is both what the typeahead matches against and what a surface writes,
 * so a vocabulary row carries its whole `metadata.…` path as its label — typing
 * `latency` finds `metadata.latency_ms` through the matcher every surface
 * already has, with no filter of our own.
 */
export type EvaluatorContextCandidate = {
  label: string;
  /** The slot the label is rooted at; the only name a parameter can be. */
  rootName: string;
  /** Whether the label reaches inside its root rather than naming it. */
  isNested: boolean;
  value?: unknown;
  type: string;
  detail: string;
  info: string;
  section: CompletionSection;
  boost: number;
};

/**
 * Every name the three authoring surfaces offer at the top level, built once so
 * they cannot disagree about what exists. A surface turns a row into a
 * completion by adding the insertion its own syntax calls for.
 *
 * The evaluator's three inputs come first, then the record's own names as the
 * paths that read them, then the record itself — the same reading order the
 * bindings panel lays `metadata` out in.
 */
export function buildEvaluatorContextCandidates(
  evaluationContext: MaterializedEvaluatorContext
): EvaluatorContextCandidate[] {
  const recordSection = RECORD_SECTION_BY_GRAIN[evaluationContext.grain];
  const inputs = evaluationContext.evaluatorInputs.map((entry, index) => ({
    label: entry.name,
    rootName: entry.name,
    isNested: false,
    ...("value" in entry ? { value: entry.value } : {}),
    type: "variable",
    detail: getEvaluatorInputDetail({ entry, evaluationContext }),
    info: getEvaluatorInputInfo(entry),
    section: EVALUATOR_INPUT_SECTION,
    boost: 100 - index,
  }));
  const vocabulary = evaluationContext.vocabulary.map((entry, index) => ({
    label: entry.name,
    rootName: EVALUATOR_METADATA_SLOT,
    isNested: true,
    ...("value" in entry ? { value: entry.value } : {}),
    type: entry.status === "unresolved" ? UNSET_COMPLETION_TYPE : "variable",
    // Only a sampled record can preview a value; before one is picked the
    // name alone is the whole offer, and "not set" would be a lie.
    detail:
      entry.status === "resolved"
        ? toMemberPreview(entry.value)
        : entry.status === "unresolved"
          ? "not set"
          : "",
    info: entry.description ?? "No setup needed.",
    section: recordSection,
    boost: 100 - index,
  }));
  return [...inputs, ...vocabulary, toRecordCandidate(evaluationContext)];
}

/** The whole record, under the `metadata` key that holds it. */
function toRecordCandidate(
  evaluationContext: MaterializedEvaluatorContext
): EvaluatorContextCandidate {
  const label = `${EVALUATOR_METADATA_SLOT}.${evaluationContext.grain}`;
  const resolution = resolveEvaluatorPath({
    source: evaluationContext.values,
    path: label,
  });
  return {
    label,
    rootName: EVALUATOR_METADATA_SLOT,
    isNested: true,
    ...(resolution.status === "resolved" ? { value: resolution.value } : {}),
    type: "variable",
    detail: "object",
    info: `The whole ${evaluationContext.grain}.`,
    section: RECORD_SECTION_BY_GRAIN[evaluationContext.grain],
    boost: 0,
  };
}

/**
 * The members one step inside `containerPath`, by the same walk the path field
 * uses. `source` is what the path is read against: the evaluator's own values,
 * or the item a template section repeats over.
 */
export function getEvaluatorContextMembers({
  source,
  containerPath,
}: {
  source: Record<string, unknown>;
  containerPath: string;
}): EvaluatorPathMember[] {
  const resolution = resolveEvaluatorPath({ source, path: containerPath });
  return resolution.status === "resolved"
    ? getEvaluatorPathMembers(resolution.value, containerPath)
    : [];
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
  const provenance = entry.provenance;
  // An evaluator input's origin is what its row has to teach, so it owns the
  // detail column; a value preview beside it only crowds out the path.
  return provenance.kind === "path"
    ? `← ${provenance.path}`
    : entry.status === "resolved" && evaluationContext.hasSampledRecord
      ? toMemberPreview(entry.value)
      : "";
}

function getEvaluatorInputInfo(
  entry: MaterializedEvaluatorContextEntry
): string {
  if (entry.name === EVALUATOR_METADATA_SLOT) {
    return "Everything else about the record. Set in Evaluator input.";
  }
  return "Set in Evaluator input.";
}
