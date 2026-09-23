import { getInstanceLabel } from "@phoenix/agent/tools/playgroundPrompt";
import {
  getToolDefinitionDisplay,
  getToolName,
} from "@phoenix/pages/playground/playgroundUtils";
import type { Tool } from "@phoenix/store/playground";

import type {
  PromptToolDisplayEntry,
  PromptToolsDisplaySnapshot,
  PromptToolsWriteSummary,
  WritePromptToolsPlan,
} from "./types";

/**
 * Materializes one tool to the exact text the playground tool editor shows:
 * function tools through `getToolDefinitionDisplay` in the active provider's
 * wire format, raw vendor tools through their opaque `raw` blob — both
 * serialized with the same `JSON.stringify(…, null, 2)` the editor uses. The
 * diff is therefore character-for-character what the user edits and coupled to
 * the provider exactly like the editor.
 */
function toDisplayEntry(
  tool: Tool,
  provider: ModelProvider
): PromptToolDisplayEntry {
  const displayValue =
    tool.kind === "raw"
      ? tool.raw
      : getToolDefinitionDisplay(tool.definition, provider);
  return {
    id: tool.id,
    name: getToolName(tool) ?? `tool-${tool.id}`,
    text: JSON.stringify(displayValue, null, 2),
  };
}

/** Builds a before/after diff operand from an instance's tool list. */
export function buildPromptToolsDisplaySnapshot({
  instanceId,
  index,
  tools,
  provider,
}: {
  instanceId: number;
  index: number;
  tools: Tool[];
  provider: ModelProvider;
}): PromptToolsDisplaySnapshot {
  return {
    instanceId,
    index,
    label: getInstanceLabel(index),
    entries: tools.map((tool) => toDisplayEntry(tool, provider)),
  };
}

/**
 * Renders a display snapshot to the plain text the diff is computed over. Each
 * tool is a name-headed section so the unified diff labels changes by the tool
 * name the user recognizes; surviving tools keep their order (deletes drop in
 * place, creates append), which produces a clean, minimal diff.
 */
export function promptToolsSnapshotToText(
  snapshot: PromptToolsDisplaySnapshot
): string {
  return snapshot.entries
    .map((entry) => `// ${entry.name}\n${entry.text}`)
    .join("\n\n");
}

/**
 * Derives a name-keyed change summary from a plan, pairing before/after tools
 * by id so each change is described by the tool name. Created/updated names are
 * read from the after-list (post-patch), deleted names from the before-list.
 */
export function computePromptToolsWriteSummary(
  plan: WritePromptToolsPlan
): PromptToolsWriteSummary {
  const nameOf = (tools: Tool[], id: number): string => {
    const tool = tools.find((candidate) => candidate.id === id);
    return (tool && getToolName(tool)) || `tool-${id}`;
  };
  const created: string[] = [];
  const updated: string[] = [];
  for (const result of plan.results) {
    const name = nameOf(plan.afterTools, result.toolId);
    if (result.status === "created") created.push(name);
    else updated.push(name);
  }
  const deleted = plan.deletedToolIds.map((id) => nameOf(plan.beforeTools, id));
  return {
    instanceIndex: plan.index,
    instanceLabel: getInstanceLabel(plan.index),
    created,
    updated,
    deleted,
    ...(plan.resetToolChoiceFrom != null
      ? { resetToolChoiceFrom: plan.resetToolChoiceFrom }
      : {}),
    ...(plan.renamedToolChoiceTo != null
      ? { renamedToolChoiceTo: plan.renamedToolChoiceTo }
      : {}),
  };
}

/**
 * One-line, human-readable description of a tool-write summary (e.g. "added
 * get_weather, changed get_units, removed get_forecast"). Used for the
 * collapsed tool-call preview and the diff header.
 */
export function formatPromptToolsSummaryText(
  summary: PromptToolsWriteSummary
): string {
  const parts: string[] = [];
  if (summary.created.length > 0) {
    parts.push(`added ${summary.created.join(", ")}`);
  }
  if (summary.updated.length > 0) {
    parts.push(`changed ${summary.updated.join(", ")}`);
  }
  if (summary.deleted.length > 0) {
    parts.push(`removed ${summary.deleted.join(", ")}`);
  }
  if (summary.resetToolChoiceFrom != null) {
    parts.push(`reset tool choice from ${summary.resetToolChoiceFrom}`);
  }
  if (summary.renamedToolChoiceTo != null) {
    parts.push(`forced tool choice now ${summary.renamedToolChoiceTo}`);
  }
  if (parts.length === 0) return "no tool changes";
  return parts.join(", ");
}
