/** The most spans one export may add, matching the server's cap. */
export const MAX_EXPORTED_SPANS = 200;

export const DEFAULT_EXPORTED_SPANS = 50;

/**
 * The playground, opened on a project evaluator with a dataset selected. The
 * project evaluator (not its shared evaluator) is what loads, so its own input
 * mapping is what gets calibrated.
 */
export function getProjectEvaluatorPlaygroundPath({
  projectEvaluatorId,
  datasetId,
  splitIds = [],
}: {
  projectEvaluatorId: string;
  datasetId: string;
  splitIds?: string[];
}): string {
  const searchParams = new URLSearchParams({
    projectEvaluator0: projectEvaluatorId,
    datasetId,
  });
  splitIds.forEach((splitId) => searchParams.append("splitId", splitId));
  return `/playground?${searchParams}`;
}

/** e.g. "correctness spans 2026-09-24 14:05". Dataset names must be unique. */
export function getDefaultExportedDatasetName({
  evaluatorName,
  now,
}: {
  evaluatorName: string;
  now: Date;
}): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `${evaluatorName} spans ${date} ${time}`;
}

export function isValidExportedSpanLimit(limit: number): boolean {
  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_EXPORTED_SPANS;
}
