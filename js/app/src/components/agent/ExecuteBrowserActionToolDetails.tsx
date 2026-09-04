import { parseExecuteBrowserActionRunOutput } from "@phoenix/agent/uiOperations/executeBrowserActionTool";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { ApprovalCard } from "./ApprovalCard";
import { LazyToolPartFileView } from "./LazyToolPartPierreViews";
import {
  ToolPartCodeBlock,
  ToolPartExpandableSection,
  ToolPartLabel,
  ToolPartText,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

function parseExecuteBrowserActionScript(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as { script?: unknown };
  return typeof candidate.script === "string" ? candidate.script : null;
}

function parseExecuteBrowserActionSummary(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as { summary?: unknown };
  return typeof candidate.summary === "string" &&
    candidate.summary.trim() !== ""
    ? candidate.summary.trim()
    : null;
}

/**
 * Preview: the agent-authored summary of what the script accomplishes.
 * `summary` streams before `script`, so it appears while the call is still
 * streaming in; falls back to the script's first non-empty line when the
 * summary is missing.
 */
export function getExecuteBrowserActionToolPreview(
  part: ToolInvocationPart
): string {
  const summary = parseExecuteBrowserActionSummary(part.input);
  if (summary) {
    return summary;
  }
  const script = parseExecuteBrowserActionScript(part.input);
  if (!script) {
    return "";
  }
  const firstLine = script
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? "";
}

export function formatExecuteBrowserActionState(
  part: ToolInvocationPart
): string {
  if (part.state === "input-available") {
    return "Running script";
  }
  return formatToolState(part.state);
}

/**
 * A completed run, rendered for humans rather than as the raw model-facing
 * text: the status sentence reads as prose, and the JSON return value —
 * meaningless to most users — is demoted to a syntax-highlighted,
 * height-collapsed section at the bottom. The script's `log()` lines are
 * omitted entirely: they are model-authored progress notes for the model's
 * own next turn (often JSON fragments), not user-facing content. Falls back
 * to raw text when the output doesn't parse as a run output (e.g. parts
 * persisted by an older format).
 */
function ExecuteBrowserActionRunResult({ output }: { output: string }) {
  const run = parseExecuteBrowserActionRunOutput(output);
  if (run == null) {
    return (
      <>
        <ToolPartLabel>Result</ToolPartLabel>
        <ToolPartExpandableSection>
          <ToolPartCodeBlock>{output}</ToolPartCodeBlock>
        </ToolPartExpandableSection>
      </>
    );
  }
  return (
    <>
      <ToolPartLabel>Result</ToolPartLabel>
      <ToolPartText>{run.status}</ToolPartText>
      <ToolPartLabel>Return value</ToolPartLabel>
      <ToolPartExpandableSection>
        <LazyToolPartFileView
          fileName="return-value.json"
          contents={run.returnValue}
        />
      </ToolPartExpandableSection>
    </>
  );
}

/**
 * Details card for one `execute_browser_action` tool call: the script being
 * run, the whole-script approval when required, and the final result or error.
 */
export function ExecuteBrowserActionToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const script = parseExecuteBrowserActionScript(part.input);
  const pendingScriptApproval = useAgentContext(
    (state) => state.pendingScriptApprovalsByToolCallId[part.toolCallId]
  );

  return (
    <div className="tool-part__body">
      {script ? (
        <>
          <ToolPartLabel>Script</ToolPartLabel>
          <ToolPartExpandableSection>
            {part.state === "input-streaming" ? (
              // The still-streaming script changes on every chunk; hold off
              // on the highlighter until the input settles.
              <ToolPartCodeBlock>{script}</ToolPartCodeBlock>
            ) : (
              <LazyToolPartFileView fileName="script.js" contents={script} />
            )}
          </ToolPartExpandableSection>
        </>
      ) : null}
      {pendingScriptApproval ? (
        <ApprovalCard
          preview={{
            title: "Approval required to run this script",
            body: { kind: "text", text: pendingScriptApproval.description },
          }}
          onAccept={() => void pendingScriptApproval.accept?.()}
          onReject={() => void pendingScriptApproval.reject?.()}
          isDisabled={
            !pendingScriptApproval.accept || !pendingScriptApproval.reject
          }
          staleMessage="This script was proposed in an earlier session and can't be run from here. Re-run your request to have PXI propose it again."
        />
      ) : null}
      {part.state === "output-available" ? (
        <ExecuteBrowserActionRunResult
          output={stringifyToolValue(part.output)}
        />
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartExpandableSection>
            <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
          </ToolPartExpandableSection>
        </>
      ) : null}
    </div>
  );
}
