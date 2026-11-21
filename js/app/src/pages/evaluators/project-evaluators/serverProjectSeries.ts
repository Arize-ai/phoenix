/** How many projects get their own series and color. */
export const SHOWN_PROJECT_COUNT = 5;

export const OTHER_PROJECTS_KEY = "other";

export type RankedProject = {
  id: string;
  name: string;
  /** Evaluations completed in the time range, evaluated or failed. */
  completedCount: number;
};

/**
 * Every project with an evaluator, busiest first: by evaluations completed in
 * the range, then by name, then by id, so equal projects keep their order.
 */
export function rankProjects(
  groups: ReadonlyArray<{
    project: { id: string; name: string };
    evaluatedCount: number;
    failedCount: number;
  }>
): RankedProject[] {
  return groups
    .map(({ project, evaluatedCount, failedCount }) => ({
      id: project.id,
      name: project.name,
      completedCount: evaluatedCount + failedCount,
    }))
    .sort(
      (a, b) =>
        b.completedCount - a.completedCount ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id)
    );
}

export type ProjectSeries = {
  key: string;
  name: string;
  /** The series' slot in the categorical palette; null for other projects. */
  colorIndex: number | null;
};

export type ServerProjectSeries = {
  /** The busiest projects, busiest first, then one series for the rest. */
  series: ProjectSeries[];
  /** The series a project's values add to. */
  getKey: (projectId: string) => string;
};

/**
 * One series per project for the busiest few, in rank order so each takes the
 * next palette color, as evaluator charts do; the rest share one "other
 * projects" series, so totals still add up against the shared queue. Ranked
 * over the whole time range, a project keeps its color while the page polls.
 */
export function getServerProjectSeries(
  groups: Parameters<typeof rankProjects>[0]
): ServerProjectSeries {
  const ranked = rankProjects(groups);
  const shown = ranked
    .filter((project) => project.completedCount > 0)
    .slice(0, SHOWN_PROJECT_COUNT);
  const shownIds = new Set(shown.map((project) => project.id));
  const series: ProjectSeries[] = shown.map((project, index) => ({
    key: project.id,
    name: project.name,
    colorIndex: index,
  }));
  const otherCount = ranked.length - shown.length;
  if (otherCount > 0) {
    series.push({
      key: OTHER_PROJECTS_KEY,
      name:
        otherCount === 1 ? "1 other project" : `${otherCount} other projects`,
      colorIndex: null,
    });
  }
  return {
    series,
    getKey: (projectId) =>
      shownIds.has(projectId) ? projectId : OTHER_PROJECTS_KEY,
  };
}
