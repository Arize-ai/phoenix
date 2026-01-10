import type { ExecutionMode } from "../modes/types.js";

interface ContextMetadata {
  phoenixUrl: string;
  snapshotTime: Date;
  spansPerProject?: number;
}

interface ProjectStats {
  name: string;
  spanCount: number;
  hasErrors?: boolean;
  recentSpans?: number;
}

interface DatasetInfo {
  name: string;
  exampleCount: number;
  updatedAt?: string;
}

interface ExperimentInfo {
  id: string;
  datasetName: string;
  projectName?: string;
  status: "completed" | "in_progress" | "failed";
  runCounts: {
    successful: number;
    failed: number;
    missing: number;
  };
  updatedAt?: string;
}

interface PromptInfo {
  name: string;
  versionCount: number;
  latestVersion?: string;
  updatedAt?: string;
}

/**
 * Generates a _context.md summary file for the Phoenix snapshot
 * This provides human and agent-readable context about what data is available
 */
export async function generateContext(
  mode: ExecutionMode,
  metadata: ContextMetadata
): Promise<void> {
  const lines: string[] = [];

  // Header
  lines.push("# Phoenix Snapshot Context");
  lines.push("");

  // Collect stats from the snapshot
  const stats = await collectSnapshotStats(mode);

  // What's Here section
  lines.push("## What's Here");

  // Projects summary
  if (stats.projects.length > 0) {
    const projectSummary = stats.projects
      .map((p) => `${p.name} (${p.spanCount} spans)`)
      .join(", ");
    lines.push(`- **${stats.projects.length} projects**: ${projectSummary}`);
  } else {
    lines.push("- **No projects found**");
  }

  // Datasets summary
  if (stats.datasets.length > 0) {
    const datasetNames = stats.datasets.map((d) => d.name).join(", ");
    lines.push(`- **${stats.datasets.length} datasets**: ${datasetNames}`);
  } else {
    lines.push("- **No datasets found**");
  }

  // Experiments summary
  if (stats.experiments.length > 0) {
    const completedCount = stats.experiments.filter(
      (e) => e.status === "completed"
    ).length;
    const inProgressCount = stats.experiments.filter(
      (e) => e.status === "in_progress"
    ).length;
    const failedCount = stats.experiments.filter(
      (e) => e.status === "failed"
    ).length;

    const parts: string[] = [];
    if (completedCount > 0) parts.push(`${completedCount} completed`);
    if (inProgressCount > 0) parts.push(`${inProgressCount} in progress`);
    if (failedCount > 0) parts.push(`${failedCount} failed`);

    lines.push(
      `- **${stats.experiments.length} experiments**: ${parts.join(", ")}`
    );
  } else {
    lines.push("- **No experiments found**");
  }

  // Prompts summary
  if (stats.prompts.length > 0) {
    const promptNames = stats.prompts.map((p) => p.name).join(", ");
    lines.push(`- **${stats.prompts.length} prompts**: ${promptNames}`);
  } else {
    lines.push("- **No prompts found**");
  }

  // Snapshot metadata
  lines.push(
    `- **Snapshot**: Created ${formatRelativeTime(metadata.snapshotTime)} from ${metadata.phoenixUrl}`
  );
  lines.push("");

  // Recent Activity section (if we have recent data)
  const recentActivity = getRecentActivity(stats);
  if (recentActivity.length > 0) {
    lines.push("## Recent Activity");
    for (const activity of recentActivity) {
      lines.push(`- ${activity}`);
    }
    lines.push("");
  }

  // What You Can Do section
  lines.push("## What You Can Do");
  lines.push("- **Explore**: ls, cat, grep, find, jq, awk, sed");
  lines.push(
    "- **Fetch more data**: `px-fetch-more spans --project <name> --limit 500`"
  );
  lines.push(
    "- **Fetch specific trace**: `px-fetch-more trace --trace-id <id>`"
  );
  lines.push("");

  // Data Freshness section
  lines.push("## Data Freshness");
  lines.push(
    "This is a **read-only snapshot**. Data may have changed since capture."
  );
  lines.push("Run with `--refresh` to get latest data.");
  lines.push("");

  // File Formats section
  lines.push("## File Formats");
  lines.push(
    "- `.jsonl` files: One JSON object per line, use `jq -s` to parse as array"
  );
  lines.push("- `.json` files: Standard JSON");
  lines.push("- `.md` files: Markdown (prompt templates)");
  lines.push("");

  // Directory Structure section
  lines.push("## Directory Structure");
  lines.push("```");
  lines.push("/phoenix/");
  lines.push("  _context.md                    # This file");
  lines.push("  /projects/");
  lines.push("    index.jsonl                  # List of all projects");
  lines.push("    /{project_name}/");
  lines.push("      metadata.json              # Project details");
  lines.push("      /spans/");
  lines.push("        index.jsonl              # Span data (may be sampled)");
  lines.push("        metadata.json            # Span snapshot metadata");
  lines.push("  /datasets/");
  lines.push("    index.jsonl                  # List of all datasets");
  lines.push("    /{dataset_name}/");
  lines.push("      metadata.json              # Dataset details");
  lines.push("      examples.jsonl             # Dataset examples");
  lines.push("  /experiments/");
  lines.push("    index.jsonl                  # List of all experiments");
  lines.push("    /{experiment_id}/");
  lines.push("      metadata.json              # Experiment details");
  lines.push("      runs.jsonl                 # Experiment runs");
  lines.push("  /prompts/");
  lines.push("    index.jsonl                  # List of all prompts");
  lines.push("    /{prompt_name}/");
  lines.push("      metadata.json              # Prompt details");
  lines.push("      /versions/");
  lines.push("        index.jsonl              # Version list");
  lines.push("        /{version_id}.md         # Version template");
  lines.push("  /_meta/");
  lines.push("    snapshot.json                # Snapshot metadata");
  lines.push("```");

  // Write the context file
  await mode.writeFile("/phoenix/_context.md", lines.join("\n"));
}

/**
 * Collects statistics from the snapshot filesystem
 */
async function collectSnapshotStats(mode: ExecutionMode): Promise<{
  projects: ProjectStats[];
  datasets: DatasetInfo[];
  experiments: ExperimentInfo[];
  prompts: PromptInfo[];
}> {
  const result = {
    projects: [] as ProjectStats[],
    datasets: [] as DatasetInfo[],
    experiments: [] as ExperimentInfo[],
    prompts: [] as PromptInfo[],
  };

  // Collect project stats
  try {
    const projectsExec = await mode.exec(
      "cat /phoenix/projects/index.jsonl 2>/dev/null || true"
    );
    if (projectsExec.stdout) {
      const projectLines = projectsExec.stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      for (const line of projectLines) {
        try {
          const project = JSON.parse(line);
          const stats: ProjectStats = {
            name: project.name,
            spanCount: 0,
          };

          // Get span count for this project
          const spansMetaExec = await mode.exec(
            `cat /phoenix/projects/${project.name}/spans/metadata.json 2>/dev/null || echo "{}"`
          );
          if (spansMetaExec.stdout) {
            try {
              const spansMeta = JSON.parse(spansMetaExec.stdout);
              stats.spanCount = spansMeta.spanCount || 0;
            } catch (e) {
              // Ignore parse errors
            }
          }

          result.projects.push(stats);
        } catch (e) {
          // Skip invalid project lines
        }
      }
    }
  } catch (e) {
    // No projects file
  }

  // Collect dataset stats
  try {
    const datasetsExec = await mode.exec(
      "cat /phoenix/datasets/index.jsonl 2>/dev/null || true"
    );
    if (datasetsExec.stdout) {
      const datasetLines = datasetsExec.stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      for (const line of datasetLines) {
        try {
          const dataset = JSON.parse(line);

          // Get example count
          const examplesExec = await mode.exec(
            `wc -l < /phoenix/datasets/${dataset.name}/examples.jsonl 2>/dev/null || echo "0"`
          );
          const exampleCount = parseInt(examplesExec.stdout.trim()) || 0;

          result.datasets.push({
            name: dataset.name,
            exampleCount,
            updatedAt: dataset.updated_at,
          });
        } catch (e) {
          // Skip invalid dataset lines
        }
      }
    }
  } catch (e) {
    // No datasets file
  }

  // Collect experiment stats
  try {
    const experimentsExec = await mode.exec(
      "cat /phoenix/experiments/index.jsonl 2>/dev/null || true"
    );
    if (experimentsExec.stdout) {
      const experimentLines = experimentsExec.stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      for (const line of experimentLines) {
        try {
          const experiment = JSON.parse(line);
          const status = determineExperimentStatus(experiment);

          result.experiments.push({
            id: experiment.id,
            datasetName: experiment.datasetName || "unknown",
            projectName: experiment.project_name,
            status,
            runCounts: {
              successful: experiment.successful_run_count || 0,
              failed: experiment.failed_run_count || 0,
              missing: experiment.missing_run_count || 0,
            },
            updatedAt: experiment.updated_at,
          });
        } catch (e) {
          // Skip invalid experiment lines
        }
      }
    }
  } catch (e) {
    // No experiments file
  }

  // Collect prompt stats
  try {
    const promptsExec = await mode.exec(
      "cat /phoenix/prompts/index.jsonl 2>/dev/null || true"
    );
    if (promptsExec.stdout) {
      const promptLines = promptsExec.stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      for (const line of promptLines) {
        try {
          const prompt = JSON.parse(line);

          // Count versions
          const versionsExec = await mode.exec(
            `wc -l < /phoenix/prompts/${prompt.name}/versions/index.jsonl 2>/dev/null || echo "0"`
          );
          const versionCount = parseInt(versionsExec.stdout.trim()) || 0;

          result.prompts.push({
            name: prompt.name,
            versionCount,
            updatedAt: prompt.updated_at,
          });
        } catch (e) {
          // Skip invalid prompt lines
        }
      }
    }
  } catch (e) {
    // No prompts file
  }

  return result;
}

/**
 * Determines the status of an experiment based on its run counts
 */
function determineExperimentStatus(
  experiment: any
): "completed" | "in_progress" | "failed" {
  const totalExpected = experiment.example_count * experiment.repetitions;
  const totalRuns =
    (experiment.successful_run_count || 0) + (experiment.failed_run_count || 0);

  if (totalRuns === 0) {
    return "in_progress";
  }

  // If most runs are failed, consider it failed
  if (
    (experiment.failed_run_count || 0) > (experiment.successful_run_count || 0)
  ) {
    return "failed";
  }

  if (totalRuns >= totalExpected) {
    return "completed";
  }

  return "in_progress";
}

/**
 * Gets recent activity highlights
 */
function getRecentActivity(stats: {
  projects: ProjectStats[];
  datasets: DatasetInfo[];
  experiments: ExperimentInfo[];
  prompts: PromptInfo[];
}): string[] {
  const activities: string[] = [];

  // Find recently updated experiments
  const recentExperiments = stats.experiments
    .filter((e) => e.updatedAt && isRecent(new Date(e.updatedAt), 24))
    .sort(
      (a, b) =>
        new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime()
    );

  for (const exp of recentExperiments.slice(0, 2)) {
    const timeAgo = formatRelativeTime(new Date(exp.updatedAt!));
    activities.push(
      `${exp.projectName || exp.datasetName}: experiment "${exp.id.slice(0, 8)}..." ${exp.status} ${timeAgo}`
    );
  }

  // Find recently updated datasets
  const recentDatasets = stats.datasets
    .filter((d) => d.updatedAt && isRecent(new Date(d.updatedAt), 24))
    .sort(
      (a, b) =>
        new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime()
    );

  for (const dataset of recentDatasets.slice(0, 2)) {
    const timeAgo = formatRelativeTime(new Date(dataset.updatedAt!));
    activities.push(
      `${dataset.name}: dataset updated ${timeAgo} (${dataset.exampleCount} examples)`
    );
  }

  return activities.slice(0, 3); // Limit to 3 activities
}

/**
 * Checks if a date is within the specified hours from now
 */
function isRecent(date: Date, hoursAgo: number): boolean {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff < hoursAgo * 60 * 60 * 1000;
}

/**
 * Formats a date as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return "just now";
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else {
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
}
