import { createEvaluator } from "@arizeai/phoenix-evals";

import { detectMarkdownViolations } from "../utils/index.js";

export const terminalSafeFormatEvaluator = createEvaluator(
  ({ output }: { output: string | null | undefined }) => {
    // Handle null/empty output
    if (!output || typeof output !== "string") {
      return {
        score: 0,
        label: "error",
        explanation: "No output or invalid output type",
      };
    }

    const { hasViolations, violations } = detectMarkdownViolations(output);

    const score = hasViolations ? 0 : 1;
    const label = hasViolations ? "unsafe" : "safe";

    const explanation = hasViolations
      ? `Found markdown syntax: ${violations
          .map(
            (v) =>
              `${v.pattern} (${v.matches.length} occurrence${v.matches.length > 1 ? "s" : ""} on line${v.lines.length > 1 ? "s" : ""} ${v.lines.join(", ")})`
          )
          .join("; ")}`
      : "Output is terminal-safe (no markdown syntax detected)";

    return { score, label, explanation };
  },
  {
    name: "terminal-safe-format",
    kind: "CODE",
    optimizationDirection: "MAXIMIZE",
  }
);
