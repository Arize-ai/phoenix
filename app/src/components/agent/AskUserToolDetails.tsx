import type {
  ElicitToolInput,
  ElicitToolOutput,
} from "@phoenix/agent/tools/elicit";
import { parseElicitToolInput } from "@phoenix/agent/tools/elicit";

import type { ToolInvocationPart, ToolUIPartState } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

/**
 * Returns the preview text for the collapsed ask_user tool summary.
 */
export function getAskUserToolPreview(part: ToolInvocationPart): string {
  const input = parseElicitToolInput(part.input);
  if (!input) return "";
  const count = input.questions.length;
  return `${count} question${count === 1 ? "" : "s"}`;
}

/**
 * Formats an ask_user tool state into a human-readable label.
 */
export function formatAskUserState(state: ToolUIPartState): string {
  switch (state) {
    case "input-streaming":
      return "Preparing questions";
    case "input-available":
      return "Awaiting response";
    case "output-available":
      return "Answered";
    case "output-error":
      return "Failed";
    default:
      return formatToolState(state);
  }
}

/**
 * Expanded detail view for an ask_user tool invocation showing the questions
 * that were asked and, if available, the user's answers.
 */
export function AskUserToolDetails({ part }: { part: ToolInvocationPart }) {
  const input = parseElicitToolInput(part.input);
  const output = part.output as ElicitToolOutput | null;

  return (
    <>
      <span className="tool-part__label">Questions</span>
      <pre>{formatQuestions(input)}</pre>
      {part.state === "output-available" && output ? (
        <>
          <span className="tool-part__label">Answers</span>
          <pre>{stringifyToolValue(output)}</pre>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <span className="tool-part__label">Error</span>
          <pre>{part.errorText}</pre>
        </>
      ) : null}
    </>
  );
}

function formatQuestions(input: ElicitToolInput | null): string {
  if (!input) return "(no questions)";
  return input.questions
    .map((q, i) => {
      const flags = [
        q.allow_skip && "skippable",
        q.allow_freeform && "freeform entry",
      ]
        .filter(Boolean)
        .join(", ");
      const flagStr = flags ? ` (${flags})` : "";
      const optionsStr = q.options
        ? "\n   " +
          q.options
            .map(
              (o) => `- ${o.label}${o.description ? ` — ${o.description}` : ""}`
            )
            .join("\n   ")
        : "";
      return `${i + 1}. [${q.type}${flagStr}] ${q.prompt}${optionsStr}`;
    })
    .join("\n\n");
}
