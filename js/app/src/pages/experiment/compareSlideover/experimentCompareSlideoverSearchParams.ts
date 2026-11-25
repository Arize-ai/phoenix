import {
  BASE_LANE_REPETITION_PARAM,
  COMPARE_LANE_EXPERIMENT_ID_PARAM,
  COMPARE_LANE_REPETITION_PARAM,
  EXPERIMENT_COMPARE_DETAILS_MODE_PARAM,
  SELECTED_EXAMPLE_ID_PARAM,
} from "@phoenix/constants/searchParams";

const EXPERIMENT_COMPARE_DETAILS_MODES = ["details", "traces"] as const;

export type ExperimentCompareDetailsMode =
  (typeof EXPERIMENT_COMPARE_DETAILS_MODES)[number];

/**
 * The slideover's view state as the URL carries it.
 */
export type ExperimentCompareSlideoverState = {
  /** The open example; null when the slideover is closed */
  selectedExampleId: string | null;
  /** The experiment picked for the right lane; null when none was picked */
  compareLaneExperimentId: string | null;
  mode: ExperimentCompareDetailsMode;
  /** 1-based repetition requested for the base lane */
  baseRepetitionNumber: number;
  /** 1-based repetition requested for the compare lane */
  compareRepetitionNumber: number;
};

const DEFAULT_MODE: ExperimentCompareDetailsMode = "details";
const DEFAULT_REPETITION_NUMBER = 1;

function isExperimentCompareDetailsMode(
  value: string | null
): value is ExperimentCompareDetailsMode {
  return EXPERIMENT_COMPARE_DETAILS_MODES.some((mode) => mode === value);
}

function parseRepetitionNumber(value: string | null): number {
  const repetitionNumber = Number(value);
  return Number.isInteger(repetitionNumber) && repetitionNumber >= 1
    ? repetitionNumber
    : DEFAULT_REPETITION_NUMBER;
}

/**
 * Reads the slideover's state from the URL. Missing or malformed params fall
 * back to their defaults, so any URL yields a usable state.
 */
export function parseExperimentCompareSlideoverState(
  searchParams: URLSearchParams
): ExperimentCompareSlideoverState {
  const mode = searchParams.get(EXPERIMENT_COMPARE_DETAILS_MODE_PARAM);
  return {
    selectedExampleId: searchParams.get(SELECTED_EXAMPLE_ID_PARAM) || null,
    compareLaneExperimentId:
      searchParams.get(COMPARE_LANE_EXPERIMENT_ID_PARAM) || null,
    mode: isExperimentCompareDetailsMode(mode) ? mode : DEFAULT_MODE,
    baseRepetitionNumber: parseRepetitionNumber(
      searchParams.get(BASE_LANE_REPETITION_PARAM)
    ),
    compareRepetitionNumber: parseRepetitionNumber(
      searchParams.get(COMPARE_LANE_REPETITION_PARAM)
    ),
  };
}

function setOrDeleteParam({
  searchParams,
  name,
  value,
}: {
  searchParams: URLSearchParams;
  name: string;
  value: string | null;
}) {
  if (value == null) {
    searchParams.delete(name);
  } else {
    searchParams.set(name, value);
  }
}

/**
 * Returns a copy of the search params with the given slideover state changes
 * written. Values equal to their default are dropped from the URL, and every
 * unrelated param is kept.
 * @param params.searchParams - the current search params
 * @param params.changes - the state fields to write; omitted fields are untouched
 */
export function applyExperimentCompareSlideoverState({
  searchParams,
  changes,
}: {
  searchParams: URLSearchParams;
  changes: Partial<ExperimentCompareSlideoverState>;
}): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (changes.selectedExampleId !== undefined) {
    setOrDeleteParam({
      searchParams: nextSearchParams,
      name: SELECTED_EXAMPLE_ID_PARAM,
      value: changes.selectedExampleId,
    });
  }
  if (changes.compareLaneExperimentId !== undefined) {
    setOrDeleteParam({
      searchParams: nextSearchParams,
      name: COMPARE_LANE_EXPERIMENT_ID_PARAM,
      value: changes.compareLaneExperimentId,
    });
  }
  if (changes.mode !== undefined) {
    setOrDeleteParam({
      searchParams: nextSearchParams,
      name: EXPERIMENT_COMPARE_DETAILS_MODE_PARAM,
      value: changes.mode === DEFAULT_MODE ? null : changes.mode,
    });
  }
  if (changes.baseRepetitionNumber !== undefined) {
    setOrDeleteParam({
      searchParams: nextSearchParams,
      name: BASE_LANE_REPETITION_PARAM,
      value:
        changes.baseRepetitionNumber === DEFAULT_REPETITION_NUMBER
          ? null
          : String(changes.baseRepetitionNumber),
    });
  }
  if (changes.compareRepetitionNumber !== undefined) {
    setOrDeleteParam({
      searchParams: nextSearchParams,
      name: COMPARE_LANE_REPETITION_PARAM,
      value:
        changes.compareRepetitionNumber === DEFAULT_REPETITION_NUMBER
          ? null
          : String(changes.compareRepetitionNumber),
    });
  }
  return nextSearchParams;
}

/**
 * The experiment the right lane shows: the one the URL asks for when it is
 * still being compared, otherwise the first compared experiment. Null when
 * only the base experiment is selected.
 * @param params.requestedExperimentId - the experiment the URL asks for
 * @param params.compareExperimentIds - the compared experiments, in display order
 */
export function resolveCompareLaneExperimentId({
  requestedExperimentId,
  compareExperimentIds,
}: {
  requestedExperimentId: string | null;
  compareExperimentIds: readonly string[];
}): string | null {
  if (
    requestedExperimentId != null &&
    compareExperimentIds.includes(requestedExperimentId)
  ) {
    return requestedExperimentId;
  }
  return compareExperimentIds[0] ?? null;
}
