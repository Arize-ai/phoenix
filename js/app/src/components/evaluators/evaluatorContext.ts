import { resolveEvaluatorPath } from "@phoenix/components/evaluators/evaluatorPathCompletions";
import type {
  EvaluatorSlotDefault,
  EvaluatorSlotName,
} from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import { EVALUATOR_SLOT_NAMES } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import {
  getEvaluatorBoundVariables,
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
};

export type MaterializedEvaluatorContext = {
  grain: ProjectEvaluatorMappingSourceGrain;
  /** False while the store contains only its generic source skeleton. */
  hasSampledRecord: boolean;
  /**
   * The three values the evaluator receives, by name. Paths an authoring tool
   * drills are resolved against this, so it stays browsable before a record is
   * sampled; `hasSampledRecord` says whether any of it may be shown.
   */
  values: Record<string, unknown>;
  evaluatorInputs: MaterializedEvaluatorContextEntry[];
  /**
   * The record's own names, as the `metadata.…` paths that read them. Binding
   * is by the three slot names alone, so these are reached by path, never by
   * name — the entry is written exactly as it must be typed.
   */
  vocabulary: MaterializedEvaluatorContextEntry[];
};

/**
 * Resolves what an evaluator receives, for the authoring tools that offer and
 * preview it.
 *
 * @param params - context inputs
 * @param params.grain - record kind the editor is authoring against
 * @param params.evaluatorMappingSource - grain-tagged sampled mapping source
 * @param params.inputMapping - current evaluator input mapping
 * @param params.slotDefaults - defaults for the selected record kind
 */
export function materializeEvaluatorContext({
  grain,
  evaluatorMappingSource,
  inputMapping,
  slotDefaults,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
  evaluatorMappingSource: EvaluatorMappingSourceState;
  inputMapping: EvaluatorInputMapping;
  slotDefaults: Readonly<Record<EvaluatorSlotName, EvaluatorSlotDefault>>;
}): MaterializedEvaluatorContext | null {
  if (evaluatorMappingSource.grain !== grain) {
    return null;
  }

  const source = evaluatorMappingSource.source as Record<string, unknown>;
  const boundVariables = getEvaluatorBoundVariables(grain);
  const recordMetadata = isStringKeyedObject(source[EVALUATOR_METADATA_SLOT])
    ? source[EVALUATOR_METADATA_SLOT]
    : {};
  // A sampled record is one whose vocabulary carries values; the generic
  // skeleton names every field and holds none of them.
  const hasSampledRecord = boundVariables.some(
    ({ name }) => recordMetadata[name] != null
  );
  const evaluatorInputs = EVALUATOR_SLOT_NAMES.map((slotName) =>
    materializeEvaluatorInput({
      slotName,
      source,
      inputMapping,
      slotDefault: slotDefaults[slotName],
      hasSampledRecord,
    })
  );
  const values: Record<string, unknown> = {};
  for (const entry of evaluatorInputs) {
    if ("value" in entry) {
      values[entry.name] = entry.value;
    }
  }

  // The vocabulary reads off whatever `metadata` ended up bound to, so what the
  // rows offer is what the evaluator would actually receive under that name.
  const boundMetadata = isStringKeyedObject(values[EVALUATOR_METADATA_SLOT])
    ? values[EVALUATOR_METADATA_SLOT]
    : {};
  const vocabulary = boundVariables.map((variable) =>
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
  slotDefault,
  hasSampledRecord,
}: {
  slotName: EvaluatorSlotName;
  source: Record<string, unknown>;
  inputMapping: EvaluatorInputMapping;
  slotDefault: EvaluatorSlotDefault;
  hasSampledRecord: boolean;
}): MaterializedEvaluatorContextEntry {
  if (Object.hasOwn(inputMapping.literalMapping, slotName)) {
    return {
      name: slotName,
      status: "resolved",
      value: inputMapping.literalMapping[slotName],
      provenance: { kind: "literal" },
    };
  }

  return materializePath({
    name: slotName,
    source,
    path: inputMapping.pathMapping[slotName] || slotDefault.path,
    hasSampledRecord,
  });
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
  };
}
