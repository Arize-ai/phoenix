import { renderGenerativeUISpecSchema } from "@phoenix/components/agent/generativeUICatalog";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import type { RenderGenerativeUIInput } from "./types";

/** Parse and validate the render_generative_ui tool input. */
export function parseRenderGenerativeUIInput(
  input: unknown
): RenderGenerativeUIInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { spec?: unknown; state?: unknown };
  const specResult = renderGenerativeUISpecSchema.safeParse(candidate.spec);
  if (!specResult.success) {
    return null;
  }
  if (candidate.state !== undefined && !isPlainObject(candidate.state)) {
    return null;
  }
  return {
    spec: specResult.data,
    state: candidate.state ?? {},
  };
}

/**
 * Maps generative UI schema failures to a user-facing tool error message.
 * Keeps chart cardinality failures specific while collapsing other schema
 * errors into a generic render failure.
 */
export function getRenderGenerativeUIInvalidInputErrorText(
  input: unknown
): string {
  const defaultErrorText = "I couldn't render that generative UI.";

  if (typeof input !== "object" || input === null) {
    return defaultErrorText;
  }

  const candidate = input as { spec?: unknown };
  const specResult = renderGenerativeUISpecSchema.safeParse(candidate.spec);
  if (specResult.success) {
    return defaultErrorText;
  }

  const hasChartRequirementIssue = specResult.error.issues.some((issue) => {
    return issue.path.some(
      (segment) =>
        segment === "data" || segment === "segments" || segment === "lines"
    );
  });

  return hasChartRequirementIssue
    ? `Request should adhere to chart requirements.`
    : defaultErrorText;
}
