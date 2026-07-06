import type { AssistantMessageMetadata, PxiMessage } from "./types";

/**
 * Token-usage helpers for the PXI status line.
 *
 * The Phoenix server attaches {@link AssistantMessageMetadata} usage to each
 * assistant turn. These helpers pull the most recent usage off the transcript
 * and format it for the bottom-right status line, mirroring how the web UI's
 * `ChatSessionUsage` surfaces the latest token count plus any cache activity so
 * the user can gauge how much of the context window is in play.
 */

/** The usage metadata reported for a single assistant turn. */
export type PxiUsage = NonNullable<AssistantMessageMetadata["usage"]>;

/**
 * Return the usage reported by the most recent assistant message that carries
 * any, scanning newest-first. Returns `null` when no assistant turn reported
 * usage (tracing/usage reporting can be disabled server-side).
 */
export function getLatestAssistantUsage(
  messages: PxiMessage[]
): PxiUsage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role !== "assistant") {
      continue;
    }
    const usage = message.metadata?.usage;
    if (usage != null) {
      return usage;
    }
  }
  return null;
}

/** Format a token count with thousands separators (e.g. `12,345`). */
export function formatTokenCount(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Build the cache-activity portion of the status line from a turn's prompt
 * details, matching the web UI: always show cache reads, and only show cache
 * writes when non-zero (OpenAI never reports them). Returns `null` when there
 * is no cache activity to surface.
 */
export function formatCacheSummary(
  promptDetails: PxiUsage["promptDetails"]
): string | null {
  if (!promptDetails) {
    return null;
  }
  const cacheRead = promptDetails.cacheRead ?? 0;
  const cacheWrite = promptDetails.cacheWrite ?? 0;
  if (cacheRead <= 0 && cacheWrite <= 0) {
    return null;
  }
  const parts = [`cache read ${formatTokenCount(cacheRead)}`];
  if (cacheWrite > 0) {
    parts.push(`cache write ${formatTokenCount(cacheWrite)}`);
  }
  return parts.join(" / ");
}

/**
 * Compose the full bottom-right status line for a turn's usage — the headline
 * total token count, optionally preceded by a cache-activity summary. Returns
 * `null` when there is no usage to show, so the caller can omit the line
 * entirely.
 */
export function formatTokenUsageLine(usage: PxiUsage | null): string | null {
  if (!usage) {
    return null;
  }
  const segments: string[] = [];
  const cacheSummary = formatCacheSummary(usage.promptDetails);
  if (cacheSummary) {
    segments.push(cacheSummary);
  }
  segments.push(`${formatTokenCount(usage.tokens.total)} tokens`);
  return segments.join("  ·  ");
}
