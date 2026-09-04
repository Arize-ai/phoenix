import { resolveEvaluatorPath } from "@phoenix/components/evaluators/evaluatorPathCompletions";
import type { EvaluatorSlotName } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import { EVALUATOR_SLOT_NAMES } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import {
  getEvaluatorBoundVariables,
  getEvaluatorMetadataEntries,
  type EvaluatorBoundVariable,
} from "@phoenix/pages/project/evaluators/evaluatorBoundVariables";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorMappingSourceState } from "@phoenix/store/evaluatorStore";
import type { EvaluatorInputMapping } from "@phoenix/types";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/** The context key everything but the evaluator's input and output sits under. */
export const EVALUATOR_METADATA_SLOT = "metadata";

export type EvaluatorContextEntryStatus =
  | "resolved"
  | "unresolved"
  | "unverifiable";

export type EvaluatorContextProvenance =
  | { kind: "path"; path: string }
  | { kind: "literal" };

export type MaterializedEvaluatorContextEntry = {
  /** What the entry is written as: a slot name, or a `metadata.…` path. */
  name: string;
  status: EvaluatorContextEntryStatus;
  value?: unknown;
  provenance: EvaluatorContextProvenance;
  description?: string;
  /** An object or list the author can drill into. */
  isContainer?: boolean;
};

export type MaterializedEvaluatorContext = {
  grain: ProjectEvaluatorMappingSourceGrain;
  /** False while the store holds only the grain's default source. */
  hasSampledRecord: boolean;
  /**
   * The three values the evaluator receives, by name. Paths an authoring tool
   * drills are resolved against this, so it stays browsable before a record is
   * sampled; `hasSampledRecord` says whether any of it may be shown.
   */
  values: Record<string, unknown>;
  evaluatorInputs: MaterializedEvaluatorContextEntry[];
  /**
   * The record's own names — the filter vocabulary, then the record fields —
   * as the `metadata.…` paths that read them. Binding is by the three slot
   * names alone, so these are reached by path, never by name — the entry is
   * written exactly as it must be typed.
   */
  vocabulary: MaterializedEvaluatorContextEntry[];
};

/**
 * Resolves what an evaluator receives, for the authoring tools that offer and
 * preview it.
 */
export function materializeEvaluatorContext({
  grain,
  evaluatorMappingSource,
  inputMapping,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
  evaluatorMappingSource: EvaluatorMappingSourceState;
  inputMapping: EvaluatorInputMapping;
}): MaterializedEvaluatorContext | null {
  if (evaluatorMappingSource.grain !== grain) {
    return null;
  }

  const source = evaluatorMappingSource.source as Record<string, unknown>;
  const boundVariables = getEvaluatorBoundVariables(grain);
  const recordMetadata = isStringKeyedObject(source[EVALUATOR_METADATA_SLOT])
    ? source[EVALUATOR_METADATA_SLOT]
    : {};
  // A sampled record is one whose vocabulary carries values; the store's
  // default source holds none.
  const hasSampledRecord = boundVariables.some(
    ({ name }) => recordMetadata[name] != null
  );
  const evaluatorInputs = EVALUATOR_SLOT_NAMES.map((slotName) =>
    materializeEvaluatorInput({
      slotName,
      source,
      inputMapping,
      hasSampledRecord,
    })
  );
  const values: Record<string, unknown> = {};
  for (const entry of evaluatorInputs) {
    if ("value" in entry) {
      values[entry.name] = entry.value;
    }
  }

  // The rows read off whatever `metadata` ended up bound to, so what they
  // offer is what the evaluator would actually receive under that name.
  const boundMetadata = isStringKeyedObject(values[EVALUATOR_METADATA_SLOT])
    ? values[EVALUATOR_METADATA_SLOT]
    : {};
  const vocabulary = getEvaluatorMetadataEntries(grain).map((variable) =>
    materializeVocabularyEntry({ variable, boundMetadata, hasSampledRecord })
  );

  return {
    grain,
    hasSampledRecord,
    values,
    evaluatorInputs,
    vocabulary,
  };
}

function materializeEvaluatorInput({
  slotName,
  source,
  inputMapping,
  hasSampledRecord,
}: {
  slotName: EvaluatorSlotName;
  source: Record<string, unknown>;
  inputMapping: EvaluatorInputMapping;
  hasSampledRecord: boolean;
}): MaterializedEvaluatorContextEntry {
  // The server resolves paths before a literal overwrites them, and a path
  // that matches nothing fails the whole evaluation. So a path the author set
  // and the record cannot answer is what the slot has to show, literal or not.
  const mappedPath = inputMapping.pathMapping[slotName];
  const mapped = mappedPath
    ? materializePath({
        name: slotName,
        source,
        path: mappedPath,
        hasSampledRecord,
      })
    : null;
  if (mapped?.status === "unresolved") {
    return mapped;
  }

  if (Object.hasOwn(inputMapping.literalMapping, slotName)) {
    return {
      name: slotName,
      status: "resolved",
      value: inputMapping.literalMapping[slotName],
      provenance: { kind: "literal" },
    };
  }

  return (
    mapped ??
    materializePath({
      name: slotName,
      source,
      path: slotName,
      hasSampledRecord,
    })
  );
}

function materializePath({
  name,
  source,
  path,
  hasSampledRecord,
}: {
  name: string;
  source: Record<string, unknown>;
  path: string;
  hasSampledRecord: boolean;
}): MaterializedEvaluatorContextEntry {
  const resolution = resolveEvaluatorPath({ source, path });
  // The value comes along even before a record has been sampled: the generic
  // skeleton still has the shape authoring tools drill through, and status
  // alone decides whether anything of it may be shown as a preview.
  return resolution.status === "resolved"
    ? {
        name,
        status: hasSampledRecord ? "resolved" : "unverifiable",
        value: resolution.value,
        provenance: { kind: "path", path },
      }
    : {
        name,
        status: hasSampledRecord ? resolution.status : "unverifiable",
        provenance: { kind: "path", path },
      };
}

function materializeVocabularyEntry({
  variable,
  boundMetadata,
  hasSampledRecord,
}: {
  variable: EvaluatorBoundVariable;
  boundMetadata: Record<string, unknown>;
  hasSampledRecord: boolean;
}): MaterializedEvaluatorContextEntry {
  const path = `${EVALUATOR_METADATA_SLOT}.${variable.name}`;
  const hasValue = Object.hasOwn(boundMetadata, variable.name);
  const isResolved = hasSampledRecord && hasValue;
  return {
    name: path,
    status: isResolved
      ? "resolved"
      : hasSampledRecord
        ? "unresolved"
        : "unverifiable",
    ...(isResolved ? { value: boundMetadata[variable.name] } : {}),
    provenance: { kind: "path", path },
    description: variable.description,
    ...(variable.type === "object" || variable.type === "list"
      ? { isContainer: true }
      : {}),
  };
}
