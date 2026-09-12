import {
  DEFAULT_TIME_WINDOW_PRESET_ID,
  isTimeWindowPresetId,
  type TimeWindowPresetId,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTimeWindow";

import { EVALUATOR_SLOT_IDS, type SlotId } from "./evaluatorSlotTypes";

/**
 * Where the playground's rows come from: the first examples of a dataset, or
 * the most recent spans of a project that match a filter inside a time window.
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
      window: TimeWindowPresetId;
    };

export type EvaluatorPlaygroundSourceKind = EvaluatorPlaygroundSource["kind"];

/** The part of the source a slot saves against. */
export type EvaluatorSlotSource =
  | { kind: "dataset"; datasetId: string }
  | { kind: "project"; projectId: string };

const DATASET_PARAMS = ["datasetId", "splitId", "datasetVersionId"] as const;
const PROJECT_PARAMS = ["projectId", "filterCondition", "window"] as const;

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

  if (projectId) {
    const window = params.get("window");

    return {
      kind: "project",
      projectId,
      filterCondition: params.get("filterCondition") ?? "",
      window:
        window && isTimeWindowPresetId(window)
          ? window
          : DEFAULT_TIME_WINDOW_PRESET_ID,
    };
  }

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

    if (next.window !== DEFAULT_TIME_WINDOW_PRESET_ID)
      params.set("window", next.window);
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

export function toEvaluatorSlotSource(
  source: EvaluatorPlaygroundSource | null
): EvaluatorSlotSource | null {
  if (!source) return null;

  return source.kind === "dataset"
    ? { kind: "dataset", datasetId: source.datasetId }
    : { kind: "project", projectId: source.projectId };
}
