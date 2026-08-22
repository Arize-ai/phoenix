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

export type EvaluatorContextEntryStatus =
  | "resolved"
  | "unset"
  | "unresolved"
  | "unverifiable";

export type EvaluatorContextProvenance =
  | { kind: "path"; path: string }
  | { kind: "literal" }
  | { kind: "derived"; description: string }
  | {
      kind: "record";
      grain: ProjectEvaluatorMappingSourceGrain;
      name: string;
    }
  | { kind: "unset" };

export type MaterializedEvaluatorContextEntry = {
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
  /** Every value the selected record can supply by evaluator parameter name. */
  values: Record<string, unknown>;
  evaluatorInputs: MaterializedEvaluatorContextEntry[];
  recordVariables: MaterializedEvaluatorContextEntry[];
};

/**
 * Resolves the evaluator inputs and record variables shown by authoring tools.
 *
 * @param params - context inputs
 * @param params.grain - record kind the editor is authoring against
 * @param params.evaluatorMappingSource - grain-tagged sampled mapping source
 * @param params.inputMapping - current evaluator input mapping
 * @param params.slotDefaults - defaults for the selected record kind
 * @param params.recordVariableValues - sampled values for record variables
 */
export function materializeEvaluatorContext({
  grain,
  evaluatorMappingSource,
  inputMapping,
  slotDefaults,
  recordVariableValues,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
  evaluatorMappingSource: EvaluatorMappingSourceState;
  inputMapping: EvaluatorInputMapping;
  slotDefaults: Readonly<Record<EvaluatorSlotName, EvaluatorSlotDefault>>;
  recordVariableValues: Record<string, unknown>;
}): MaterializedEvaluatorContext | null {
  if (evaluatorMappingSource.grain !== grain) {
    return null;
  }

  const source = evaluatorMappingSource.source as Record<string, unknown>;
  const hasSampledRecord = Object.values(recordVariableValues).some(
    (value) => value != null
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
  const recordVariables = getEvaluatorBoundVariables(grain).map((variable) =>
    materializeRecordVariable({
      grain,
      variable,
      values: recordVariableValues,
      hasSampledRecord,
    })
  );
  const values: Record<string, unknown> = {};
  for (const entry of [...evaluatorInputs, ...recordVariables]) {
    if (entry.status === "resolved") {
      values[entry.name] = entry.value;
    }
  }

  return {
    grain,
    hasSampledRecord,
    values,
    evaluatorInputs,
    recordVariables,
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

  const configuredPath = inputMapping.pathMapping[slotName];
  if (configuredPath) {
    return materializePath({
      name: slotName,
      source,
      path: configuredPath,
      hasSampledRecord,
    });
  }

  if (slotDefault === null) {
    return {
      name: slotName,
      status: "unset",
      provenance: { kind: "unset" },
    };
  }
  if (slotDefault.kind === "path") {
    return materializePath({
      name: slotName,
      source,
      path: slotDefault.path,
      hasSampledRecord,
    });
  }

  return hasSampledRecord && Object.hasOwn(source, slotName)
    ? {
        name: slotName,
        status: "resolved",
        value: source[slotName],
        provenance: {
          kind: "derived",
          description: slotDefault.description,
        },
      }
    : {
        name: slotName,
        status: "unverifiable",
        provenance: {
          kind: "derived",
          description: slotDefault.description,
        },
      };
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
  return hasSampledRecord && resolution.status === "resolved"
    ? {
        name,
        status: "resolved",
        value: resolution.value,
        provenance: { kind: "path", path },
      }
    : {
        name,
        status: hasSampledRecord ? resolution.status : "unverifiable",
        provenance: { kind: "path", path },
      };
}

function materializeRecordVariable({
  grain,
  variable,
  values,
  hasSampledRecord,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
  variable: EvaluatorBoundVariable;
  values: Record<string, unknown>;
  hasSampledRecord: boolean;
}): MaterializedEvaluatorContextEntry {
  const hasValue = Object.hasOwn(values, variable.name);
  const isResolved = hasSampledRecord && hasValue;
  return {
    name: variable.name,
    status: isResolved
      ? "resolved"
      : hasSampledRecord
        ? "unresolved"
        : "unverifiable",
    ...(isResolved ? { value: values[variable.name] } : {}),
    provenance: { kind: "record", grain, name: variable.name },
    description: variable.description,
  };
}
