import { parseDiffFromFile } from "@pierre/diffs";

import type {
  PromptEditSummary,
  PromptMessageSnapshot,
  PromptSnapshot,
} from "./types";

/** Renders a prompt snapshot to the plain text used for diffing/display. */
export function promptSnapshotToText(snapshot: PromptSnapshot): string {
  return snapshot.messages.map(formatMessage).join("\n\n");
}

function formatMessage(message: PromptMessageSnapshot): string {
  return [
    `role: ${message.role}`,
    message.content !== undefined ? `content:\n${message.content}` : null,
    message.toolCalls !== undefined
      ? `toolCalls:\n${JSON.stringify(message.toolCalls, null, 2)}`
      : null,
  ]
    .filter((line): line is string => line != null)
    .join("\n\n");
}

/**
 * Computes a GitHub-style line-change summary between two prompt snapshots,
 * tallying added/removed lines across all diff hunks.
 */
export function computePromptEditSummary(
  before: PromptSnapshot,
  after: PromptSnapshot
): PromptEditSummary {
  const fileName = `playground-instance-${after.instanceId}.txt`;
  let additions = 0;
  let deletions = 0;
  try {
    const diff = parseDiffFromFile(
      { name: fileName, contents: promptSnapshotToText(before) },
      { name: fileName, contents: promptSnapshotToText(after) }
    );
    for (const hunk of diff.hunks) {
      additions += hunk.additionLines;
      deletions += hunk.deletionLines;
    }
  } catch {
    // Fall back to zero counts if the diff can't be parsed.
  }
  return {
    instanceIndex: after.index,
    instanceLabel: after.label,
    additions,
    deletions,
  };
}
