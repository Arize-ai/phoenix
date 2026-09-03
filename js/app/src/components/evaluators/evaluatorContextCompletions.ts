import type { Completion, CompletionSection } from "@codemirror/autocomplete";

import type {
  MaterializedEvaluatorContext,
  MaterializedEvaluatorContextEntry,
} from "@phoenix/components/evaluators/evaluatorContext";
import { EVALUATOR_METADATA_SLOT } from "@phoenix/components/evaluators/evaluatorContext";
import type { EvaluatorPathMember } from "@phoenix/components/evaluators/evaluatorPathCompletions";
import {
  CONTAINER_COMPLETION_TYPE,
  getEvaluatorPathMembers,
  resolveEvaluatorPath,
  toMemberCompletionType,
  toMemberPreview,
} from "@phoenix/components/evaluators/evaluatorPathCompletions";
import {
  TYPEAHEAD_COMPLETION_CLASS_PREFIX,
  toTypeaheadCompletionClass,
} from "@phoenix/components/filter/styles";

export const EVALUATOR_INPUT_SECTION: CompletionSection = {
  name: "Evaluator input",
  rank: 1,
};

export const RECORD_SECTION_BY_GRAIN: Record<
  MaterializedEvaluatorContext["grain"],
  CompletionSection
> = {
  span: { name: "From the span", rank: 2 },
  session: { name: "From the session", rank: 2 },
};

/** A row for a name the selected record does not supply; dimmed, not dropped. */
export const UNSET_COMPLETION_TYPE = `${TYPEAHEAD_COMPLETION_CLASS_PREFIX}unset`;

/** A row whose detail reads as prose rather than as a value. */
export const HINT_COMPLETION_TYPE = `${TYPEAHEAD_COMPLETION_CLASS_PREFIX}hint`;

export function toEvaluatorCompletionClass(completion: Completion): string {
  return toTypeaheadCompletionClass(completion.type);
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
 * paths that read them — the same reading order the bindings panel lays
 * `metadata` out in.
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
    type: "value" in entry ? toMemberCompletionType(entry.value) : "variable",
    detail: getEvaluatorInputDetail({ entry, evaluationContext }),
    info:
      entry.name === EVALUATOR_METADATA_SLOT
        ? `${capitalize(evaluationContext.grain)} properties.`
        : "",
    section: EVALUATOR_INPUT_SECTION,
    boost: 100 - index,
  }));
  const vocabulary = evaluationContext.vocabulary.map((entry, index) => ({
    label: entry.name,
    rootName: EVALUATOR_METADATA_SLOT,
    isNested: true,
    ...("value" in entry ? { value: entry.value } : {}),
    type:
      entry.status === "unresolved"
        ? UNSET_COMPLETION_TYPE
        : entry.isContainer
          ? CONTAINER_COMPLETION_TYPE
          : "variable",
    // Only a sampled record can preview a value; before one is picked the
    // name alone is the whole offer, and "not set" would be a lie.
    detail:
      entry.status === "resolved"
        ? toMemberPreview(entry.value)
        : entry.status === "unresolved"
          ? "not set"
          : "",
    info: entry.description ?? "",
    section: recordSection,
    boost: 100 - index,
  }));
  return [...inputs, ...vocabulary];
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
  // detail column; a value preview beside it only crowds out the path. A slot
  // left on its default reads its own key, and `← input` under a row labeled
  // `input` teaches nothing — there the value is the only thing left to show.
  return provenance.kind === "path" && provenance.path !== entry.name
    ? `← ${provenance.path}`
    : entry.status === "resolved" && evaluationContext.hasSampledRecord
      ? toMemberPreview(entry.value)
      : "";
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
