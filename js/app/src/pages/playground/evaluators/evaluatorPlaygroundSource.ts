import type { ProjectEvaluatorTarget } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

import { EVALUATOR_SLOT_IDS, type SlotId } from "./evaluatorSlotTypes";

/**
 * Where the playground's rows come from: the first examples of a dataset, or
 * the most recent spans of a project that match a filter.
 * Traces and sessions are follow-ups; a target would branch here.
 */
export type EvaluatorPlaygroundSource =
  | {
      kind: "dataset";
      datasetId: string;
      splitIds: string[];
      versionId: string | null;
    }
  | {
      kind: "project";
      projectId: string;
      /** Only an applied (validated) filter is stored; an empty string is no filter. */
      filterCondition: string;
    };

export type EvaluatorPlaygroundSourceKind = EvaluatorPlaygroundSource["kind"];

/** The part of the source a slot saves against. */
export type EvaluatorSlotSource =
  | { kind: "dataset"; datasetId: string }
  | { kind: "project"; projectId: string };

const DATASET_PARAMS = ["datasetId", "splitId", "datasetVersionId"] as const;
const PROJECT_PARAMS = ["projectId", "filterCondition"] as const;

/** The URL param that binds a slot to a saved evaluator on the source. */
export const SLOT_BINDING_PARAMS: Record<
  EvaluatorPlaygroundSourceKind,
  string
> = {
  dataset: "datasetEvaluator",
  project: "projectEvaluator",
};

export function getSlotBindingParam(
  kind: EvaluatorPlaygroundSourceKind,
  slot: SlotId
) {
  return `${SLOT_BINDING_PARAMS[kind]}${slot}`;
}

/** Removes every binding param of every kind, for the given slot or for all. */
export function clearSlotBindingParams(params: URLSearchParams, slot?: SlotId) {
  const slots = slot ? [slot] : EVALUATOR_SLOT_IDS;

  for (const current of slots)
    for (const kind of Object.keys(SLOT_BINDING_PARAMS))
      params.delete(
        getSlotBindingParam(kind as EvaluatorPlaygroundSourceKind, current)
      );
}

/**
 * Reads the source from the URL. A dataset wins over a project when a
 * hand-edited URL names both; writes never leave both in place.
 */
export function readEvaluatorPlaygroundSource(
  params: URLSearchParams
): EvaluatorPlaygroundSource | null {
  const datasetId = params.get("datasetId");

  if (datasetId)
    return {
      kind: "dataset",
      datasetId,
      splitIds: params.getAll("splitId"),
      versionId: params.get("datasetVersionId"),
    };
  const projectId = params.get("projectId");

  if (projectId)
    return {
      kind: "project",
      projectId,
      filterCondition: params.get("filterCondition") ?? "",
    };

  return null;
}

/**
 * Writes `next` over `previous`. Both kinds' params are cleared first so a
 * source of the other kind never lingers. Slot bindings name an evaluator on
 * one dataset or project, so they are cleared when the root record changes,
 * the way the dataset change has always done.
 */
export function writeEvaluatorPlaygroundSource(
  params: URLSearchParams,
  next: EvaluatorPlaygroundSource | null,
  previous: EvaluatorPlaygroundSource | null
) {
  for (const name of [...DATASET_PARAMS, ...PROJECT_PARAMS])
    params.delete(name);

  if (next?.kind === "dataset") {
    params.set("datasetId", next.datasetId);
    next.splitIds.forEach((splitId) => params.append("splitId", splitId));

    if (next.versionId) params.set("datasetVersionId", next.versionId);
  } else if (next?.kind === "project") {
    params.set("projectId", next.projectId);

    if (next.filterCondition)
      params.set("filterCondition", next.filterCondition);
  }

  if (getSourceRootId(next) !== getSourceRootId(previous))
    clearSlotBindingParams(params);
}

/** The record that the source's saved evaluators belong to. */
function getSourceRootId(source: EvaluatorPlaygroundSource | null) {
  if (!source) return null;

  return source.kind === "dataset"
    ? `dataset:${source.datasetId}`
    : `project:${source.projectId}`;
}

/** The source fields `evaluatorPlayground.configure` may set. */
export type ConfigureEvaluatorPlaygroundSourceInput = {
  datasetId?: string | null;
  splitIds?: string[];
  projectId?: string | null;
  filterCondition?: string;
};

/**
 * The source `configure` asks for. Naming a project replaces a dataset and
 * vice versa; the other fields refine the source of their own kind and are
 * rejected against the other kind rather than silently dropped.
 */
export function getConfiguredSource(
  current: EvaluatorPlaygroundSource | null,
  input: ConfigureEvaluatorPlaygroundSourceInput
):
  | { ok: true; source: EvaluatorPlaygroundSource | null }
  | { ok: false; error: string } {
  let source = getConfiguredRoot(current, input);

  if (input.splitIds) {
    if (source?.kind !== "dataset")
      return { ok: false, error: "splitIds apply to a dataset source." };
    source = { ...source, splitIds: input.splitIds };
  }

  if (input.filterCondition !== undefined) {
    if (source?.kind !== "project")
      return {
        ok: false,
        error: "filterCondition applies to a project source.",
      };
    source = { ...source, filterCondition: input.filterCondition };
  }

  return { ok: true, source };
}

/** The dataset or project `configure` names, keeping the same record's settings. */
function getConfiguredRoot(
  current: EvaluatorPlaygroundSource | null,
  input: ConfigureEvaluatorPlaygroundSourceInput
): EvaluatorPlaygroundSource | null {
  if (input.projectId !== undefined) {
    if (!input.projectId) return null;

    const same =
      current?.kind === "project" && current.projectId === input.projectId
        ? current
        : null;

    return {
      kind: "project",
      projectId: input.projectId,
      filterCondition: same?.filterCondition ?? "",
    };
  }

  if (input.datasetId !== undefined) {
    if (!input.datasetId) return null;

    const same =
      current?.kind === "dataset" && current.datasetId === input.datasetId
        ? current
        : null;

    return {
      kind: "dataset",
      datasetId: input.datasetId,
      splitIds: same?.splitIds ?? [],
      versionId: null,
    };
  }

  return current;
}

/** What a project evaluator stores beyond the evaluator itself. */
export type EvaluatorPlaygroundProjectScope = {
  filterCondition: string;
  /** A fraction in [0, 1]. */
  samplingRate: number;
  /**
   * Span only in this PR. A loaded trace or session evaluator is refused by
   * the slot, so the value only ever echoes a loaded SPAN evaluator or the
   * default; a trace or session target would branch here.
   */
  evaluationTarget: ProjectEvaluatorTarget;
};

/**
 * The scope a project save stores: the save options win, then the loaded
 * project evaluator's values, then the strip's filter at 100% sampling.
 */
export function resolveProjectScope({
  filterCondition,
  samplingRate,
  loaded,
  sourceFilterCondition,
}: {
  filterCondition?: string;
  samplingRate?: number;
  loaded: EvaluatorPlaygroundProjectScope | null;
  sourceFilterCondition: string;
}): EvaluatorPlaygroundProjectScope {
  return {
    filterCondition:
      filterCondition ?? loaded?.filterCondition ?? sourceFilterCondition,
    samplingRate: samplingRate ?? loaded?.samplingRate ?? 1,
    evaluationTarget: loaded?.evaluationTarget ?? "SPAN",
  };
}

export function toEvaluatorSlotSource(
  source: EvaluatorPlaygroundSource | null
): EvaluatorSlotSource | null {
  if (!source) return null;

  return source.kind === "dataset"
    ? { kind: "dataset", datasetId: source.datasetId }
    : { kind: "project", projectId: source.projectId };
}
