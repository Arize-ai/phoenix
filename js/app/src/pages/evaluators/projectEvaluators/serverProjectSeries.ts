/** How many projects get their own series when none are picked. */
export const DEFAULT_SHOWN_PROJECT_COUNT = 5;

/** The most projects that can be picked: one per chart color. */
export const MAX_PICKED_PROJECTS = 12;

export const OTHER_PROJECTS_KEY = "other";

export type RankedProject = {
  id: string;
  name: string;
  /** Evaluations of this project in the queue now. */
  queuedCount: number;
  /** Evaluations completed in the time range, evaluated or failed. */
  evaluationCount: number;
};

/**
 * Every project with an evaluator, heaviest first: by its evaluations in the
 * queue now, then by evaluations completed in the range, then by name.
 */
export function rankProjects({
  groups,
  queued,
}: {
  groups: ReadonlyArray<{
    project: { id: string; name: string };
    evaluatedCount: number;
    failedCount: number;
  }>;
  queued: ReadonlyArray<{ project: { id: string }; queuedCount: number }>;
}): RankedProject[] {
  const queuedById = new Map(
    queued.map(({ project, queuedCount }) => [project.id, queuedCount])
  );
  return groups
    .map(({ project, evaluatedCount, failedCount }) => ({
      id: project.id,
      name: project.name,
      queuedCount: queuedById.get(project.id) ?? 0,
      evaluationCount: evaluatedCount + failedCount,
    }))
    .sort(
      (a, b) =>
        b.queuedCount - a.queuedCount ||
        b.evaluationCount - a.evaluationCount ||
        a.name.localeCompare(b.name)
    );
}

/**
 * The projects that get their own series, heaviest first: the picked ones, or
 * when none are picked, the heaviest few that have any activity.
 */
export function getShownProjectIds(
  ranked: ReadonlyArray<RankedProject>,
  pickedIds: ReadonlyArray<string>
): string[] {
  if (pickedIds.length > 0) {
    const picked = new Set(pickedIds);
    return ranked
      .filter((project) => picked.has(project.id))
      .map((project) => project.id);
  }
  return ranked
    .filter((project) => project.queuedCount > 0 || project.evaluationCount > 0)
    .slice(0, DEFAULT_SHOWN_PROJECT_COUNT)
    .map((project) => project.id);
}
