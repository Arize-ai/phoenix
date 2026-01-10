// Export all snapshot modules
export {
  createPhoenixClient,
  PhoenixClientError,
  type PhoenixClientConfig,
} from "./client.js";
export { fetchProjects } from "./projects.js";
export { snapshotSpans, type SnapshotSpansOptions } from "./spans.js";
export { fetchDatasets } from "./datasets.js";
export { fetchExperiments } from "./experiments.js";
export { fetchPrompts } from "./prompts.js";
export { generateContext } from "./context.js";

// Import necessary types and modules for orchestration
import type { ExecutionMode } from "../modes/types.js";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import {
  createPhoenixClient,
  PhoenixClientError,
  type PhoenixClientConfig,
} from "./client.js";
import { fetchProjects } from "./projects.js";
import { snapshotSpans, type SnapshotSpansOptions } from "./spans.js";
import { fetchDatasets } from "./datasets.js";
import { fetchExperiments } from "./experiments.js";
import { fetchPrompts } from "./prompts.js";
import { generateContext } from "./context.js";
import { SnapshotProgress } from "../progress.js";

export interface SnapshotOptions {
  /**
   * Phoenix server base URL
   */
  baseURL: string;
  /**
   * Optional API key for authentication
   */
  apiKey?: string;
  /**
   * Maximum number of spans per project
   */
  spansPerProject?: number;
  /**
   * Time range filter for spans (ISO 8601 format)
   */
  startTime?: string;
  endTime?: string;
  /**
   * Whether to show progress indicators
   */
  showProgress?: boolean;
}

export interface SnapshotMetadata {
  created_at: string;
  phoenix_url: string;
  cursors: {
    spans?: Record<string, { last_end_time?: string; cursor?: string }>;
    datasets?: { last_fetch: string };
    experiments?: { last_fetch: string };
    prompts?: { last_fetch: string };
  };
  limits: {
    spans_per_project: number;
  };
}

/**
 * Orchestrates all data fetchers to create a complete Phoenix snapshot
 * @param mode - The execution mode (sandbox or local)
 * @param options - Snapshot options including server URL and limits
 */
export async function createSnapshot(
  mode: ExecutionMode,
  options: SnapshotOptions
): Promise<void> {
  const {
    baseURL,
    apiKey,
    spansPerProject = 1000,
    startTime,
    endTime,
    showProgress = false,
  } = options;

  // Create progress indicator
  const progress = new SnapshotProgress(showProgress);
  progress.start("Creating Phoenix data snapshot");

  // Create Phoenix client
  const clientConfig: PhoenixClientConfig = {
    baseURL,
    apiKey,
  };
  const client = createPhoenixClient(clientConfig);

  try {
    // 1. Fetch projects first (required for spans)
    progress.update("Fetching projects");
    try {
      await fetchProjects(client, mode);
    } catch (error) {
      progress.fail("Failed to fetch projects");
      throw new PhoenixClientError(
        `Failed to fetch projects: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof PhoenixClientError ? error.code : "UNKNOWN_ERROR",
        error
      );
    }

    // 2. Fetch spans for each project
    progress.update("Fetching spans", `${spansPerProject} per project`);
    try {
      const spansOptions: SnapshotSpansOptions = {
        spansPerProject,
        startTime,
        endTime,
      };
      await snapshotSpans(client, mode, spansOptions);
    } catch (error) {
      progress.fail("Failed to fetch spans");
      throw new PhoenixClientError(
        `Failed to fetch spans: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof PhoenixClientError ? error.code : "UNKNOWN_ERROR",
        error
      );
    }

    // 3. Fetch datasets in parallel with experiments and prompts
    progress.update("Fetching datasets, experiments, and prompts");
    const results = await Promise.allSettled([
      fetchDatasets(client, mode),
      fetchExperiments(client, mode),
      fetchPrompts(client, mode),
    ]);

    // Check for failures and collect errors
    const errors: Array<{ type: string; error: unknown }> = [];
    if (results[0].status === "rejected")
      errors.push({ type: "datasets", error: results[0].reason });
    if (results[1].status === "rejected")
      errors.push({ type: "experiments", error: results[1].reason });
    if (results[2].status === "rejected")
      errors.push({ type: "prompts", error: results[2].reason });

    if (errors.length > 0) {
      // Log individual errors
      errors.forEach(({ type, error }) => {
        console.error(
          `Warning: Failed to fetch ${type}:`,
          error instanceof Error ? error.message : String(error)
        );
      });

      // If all failed, throw error. If partial success, continue with warning
      if (errors.length === 3) {
        progress.fail("Failed to fetch supplementary data");
        throw new PhoenixClientError(
          "Failed to fetch all supplementary data (datasets, experiments, prompts)",
          "UNKNOWN_ERROR",
          errors
        );
      }
    }

    // 4. Generate context file
    progress.update("Generating context");
    await generateContext(mode, {
      phoenixUrl: baseURL,
      snapshotTime: new Date(),
      spansPerProject,
    });

    // 5. Write metadata file
    progress.update("Writing metadata");
    const metadata: SnapshotMetadata = {
      created_at: new Date().toISOString(),
      phoenix_url: baseURL,
      cursors: {
        spans: {}, // TODO: Track span cursors when span fetching supports it
        datasets: { last_fetch: new Date().toISOString() },
        experiments: { last_fetch: new Date().toISOString() },
        prompts: { last_fetch: new Date().toISOString() },
      },
      limits: {
        spans_per_project: spansPerProject,
      },
    };

    await mode.writeFile(
      "/_meta/snapshot.json",
      JSON.stringify(metadata, null, 2)
    );

    progress.succeed("✅ Snapshot created successfully!");
  } catch (error) {
    // Stop progress if not already stopped
    progress.stop();

    // Enhance error with context before rethrowing
    if (error instanceof PhoenixClientError) {
      throw error; // Already has good context
    }

    throw new PhoenixClientError(
      `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`,
      "UNKNOWN_ERROR",
      error
    );
  }
}

/**
 * Loads existing snapshot metadata if available
 * @param mode - The execution mode (sandbox or local)
 * @returns The snapshot metadata or null if not found
 */
export async function loadSnapshotMetadata(
  mode: ExecutionMode
): Promise<SnapshotMetadata | null> {
  try {
    const result = await mode.exec(
      "cat /phoenix/_meta/snapshot.json 2>/dev/null"
    );
    if (result.exitCode === 0) {
      return JSON.parse(result.stdout);
    }
  } catch (error) {
    // File doesn't exist or parse error
  }
  return null;
}

/**
 * Creates an incremental snapshot, fetching only new/updated data
 * @param mode - The execution mode (sandbox or local)
 * @param options - Snapshot options including server URL and limits
 */
export async function createIncrementalSnapshot(
  mode: ExecutionMode,
  options: SnapshotOptions
): Promise<void> {
  // Load existing metadata to get cursors
  const existingMetadata = await loadSnapshotMetadata(mode);

  if (!existingMetadata) {
    // No existing snapshot, create a full one
    await createSnapshot(mode, options);
    return;
  }

  const {
    baseURL,
    apiKey,
    spansPerProject = 1000,
    showProgress = false,
  } = options;

  // Create progress indicator
  const progress = new SnapshotProgress(showProgress);
  progress.start("Updating Phoenix data snapshot");

  // Create Phoenix client
  const clientConfig: PhoenixClientConfig = {
    baseURL,
    apiKey,
  };
  const client = createPhoenixClient(clientConfig);

  try {
    // Show time since last snapshot
    const lastSnapshotDate = new Date(existingMetadata.created_at);
    const timeSince = formatTimeSince(lastSnapshotDate);
    progress.update("Checking for updates", `last snapshot ${timeSince} ago`);

    // For incremental updates, we'll need to:
    // 1. Fetch projects (always fetch all as they're small)
    progress.update("Updating projects");
    await fetchProjects(client, mode);

    // 2. Fetch new spans using cursors from metadata
    progress.update("Fetching new spans");
    const spansOptions: SnapshotSpansOptions = {
      spansPerProject,
      // Use the last end time from previous snapshot as start time
      startTime: existingMetadata.cursors.spans
        ? Object.values(existingMetadata.cursors.spans)
            .map((cursor) => cursor.last_end_time)
            .filter(Boolean)
            .sort()
            .pop()
        : undefined,
    };
    await snapshotSpans(client, mode, spansOptions);

    // 3. For datasets/experiments, check if they've been updated
    // Compare last_fetch timestamps
    const datasetsLastFetch = existingMetadata.cursors.datasets?.last_fetch;
    const experimentsLastFetch =
      existingMetadata.cursors.experiments?.last_fetch;
    const promptsLastFetch = existingMetadata.cursors.prompts?.last_fetch;

    progress.update(
      "Checking for updates to datasets, experiments, and prompts"
    );

    // For now, we'll refetch all as the API doesn't support filtering by updated_at
    // In a future enhancement, we could check individual items for updates
    await Promise.all([
      fetchDatasets(client, mode),
      fetchExperiments(client, mode),
      fetchPrompts(client, mode),
    ]);

    // 4. Regenerate context with updated data
    progress.update("Regenerating context");
    await generateContext(mode, {
      phoenixUrl: baseURL,
      snapshotTime: new Date(),
      spansPerProject,
    });

    // 5. Update metadata
    progress.update("Updating metadata");
    const updatedSpansCursors = existingMetadata.cursors.spans || {};
    const metadata: SnapshotMetadata = {
      created_at: new Date().toISOString(),
      phoenix_url: baseURL,
      cursors: {
        spans: updatedSpansCursors,
        datasets: { last_fetch: new Date().toISOString() },
        experiments: { last_fetch: new Date().toISOString() },
        prompts: { last_fetch: new Date().toISOString() },
      },
      limits: {
        spans_per_project: spansPerProject,
      },
    };

    await mode.writeFile(
      "/_meta/snapshot.json",
      JSON.stringify(metadata, null, 2)
    );

    progress.succeed("✅ Incremental update complete!");
  } catch (error) {
    // Stop progress if not already stopped
    progress.stop();

    // Enhance error with context before rethrowing
    if (error instanceof PhoenixClientError) {
      throw error; // Already has good context
    }

    throw new PhoenixClientError(
      `Failed to create incremental snapshot: ${error instanceof Error ? error.message : String(error)}`,
      "UNKNOWN_ERROR",
      error
    );
  }
}

/**
 * Format time since a date in human-readable format
 */
function formatTimeSince(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
