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

/**
 * The projects picked in the URL, cleaned: no empty or repeated ids, and no
 * more than can be picked.
 */
export function normalizePickedProjectIds(
  projectIds: ReadonlyArray<string>
): string[] {
  return [...new Set(projectIds.filter((id) => id.length > 0))].slice(
    0,
    MAX_PICKED_PROJECTS
  );
}

export type ProjectSeries = { key: string; name: string; color: string };

export type ServerProjectSeries = {
  /** Every project with an evaluator, heaviest first. */
  ranked: RankedProject[];
  /** The shown projects, then one series for the rest unless picks filter. */
  series: ProjectSeries[];
  colorById: Map<string, string>;
  /** Picks are a filter: only the picked projects show. */
  isFiltered: boolean;
  /** Picked ids that still name a project with an evaluator. */
  pickedIds: string[];
  isShown: (projectId: string) => boolean;
  /** The series a project's values add to. */
  getKey: (projectId: string) => string;
};

/**
 * Which projects get their own series and color: the picked ones, or the
 * heaviest few. Without picks, the rest share one "other projects" series, so
 * totals still add up against the shared queue limit.
 */
export function getServerProjectSeries({
  groups,
  queued,
  pickedProjectIds,
  palette,
  otherColor,
}: {
  groups: Parameters<typeof rankProjects>[0]["groups"];
  queued: Parameters<typeof rankProjects>[0]["queued"];
  pickedProjectIds: ReadonlyArray<string>;
  palette: ReadonlyArray<string>;
  otherColor: string;
}): ServerProjectSeries {
  const ranked = rankProjects({ groups, queued });
  const known = new Set(ranked.map((project) => project.id));
  const pickedIds = pickedProjectIds.filter((id) => known.has(id));
  const shownIds = getShownProjectIds(ranked, pickedIds);
  const shown = new Set(shownIds);
  const isFiltered = pickedIds.length > 0;
  const colorById = new Map(
    shownIds.map((id, index) => [id, palette[index] ?? otherColor])
  );
  const nameById = new Map(ranked.map((project) => [project.id, project.name]));
  const series: ProjectSeries[] = shownIds.map((id) => ({
    key: id,
    name: nameById.get(id) ?? id,
    color: colorById.get(id) ?? otherColor,
  }));
  const otherCount = ranked.length - shownIds.length;
  if (!isFiltered && otherCount > 0) {
    series.push({
      key: OTHER_PROJECTS_KEY,
      name:
        otherCount === 1 ? "1 other project" : `${otherCount} other projects`,
      color: otherColor,
    });
  }
  return {
    ranked,
    series,
    colorById,
    isFiltered,
    pickedIds,
    isShown: (projectId) => shown.has(projectId),
    getKey: (projectId) =>
      shown.has(projectId) ? projectId : OTHER_PROJECTS_KEY,
  };
}
