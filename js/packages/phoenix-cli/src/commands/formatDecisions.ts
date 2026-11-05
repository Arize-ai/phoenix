import type { componentsV1 } from "@arizeai/phoenix-client";

import { formatTable } from "./formatTable";

export type OutputFormat = "pretty" | "json" | "raw";

type Decision = componentsV1["schemas"]["Decision"];

export interface FormatDecisionsOutputOptions {
  /**
   * Decisions to format.
   */
  decisions: Decision[];
  /**
   * Output format. Defaults to `"pretty"`.
   */
  format?: OutputFormat;
}

export function formatDecisionsOutput({
  decisions,
  format,
}: FormatDecisionsOutputOptions): string {
  const selected = format || "pretty";
  if (selected === "raw") {
    return JSON.stringify(decisions);
  }
  if (selected === "json") {
    return JSON.stringify(decisions, null, 2);
  }
  return formatDecisionsPretty(decisions);
}

function formatDecisionsPretty(decisions: Decision[]): string {
  if (decisions.length === 0) {
    return "No decisions found";
  }

  const rows = decisions.map((decision) => ({
    name: decision.name,
    id: decision.id,
    description: decision.description ?? "",
    updated: decision.updated_at,
  }));

  return formatTable(rows);
}
