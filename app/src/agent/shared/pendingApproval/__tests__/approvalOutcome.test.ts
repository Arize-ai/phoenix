import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { approvalOutcome } from "../approvalOutcome";

describe("approvalOutcome", () => {
  it("nests the decision and source under a reserved approval key", () => {
    expect(approvalOutcome({ decision: "accepted", source: "user" })).toEqual({
      approval: { decision: "accepted", source: "user" },
    });
    expect(approvalOutcome({ decision: "rejected", source: "user" })).toEqual({
      approval: { decision: "rejected", source: "user" },
    });
  });

  it("survives being spread after a payload that carries its own approval key", () => {
    // `pendingSavePrompt` and `pendingPromptToolWrite` spread a tool's own
    // action result into the output. Spreading the marker last is what keeps a
    // colliding key from silently winning.
    const toolPayload = { status: "saved", approval: "not-the-marker" };
    const output = {
      ...toolPayload,
      ...approvalOutcome({ decision: "accepted", source: "auto" }),
    };
    expect(output.approval).toEqual({ decision: "accepted", source: "auto" });
  });
});

/**
 * Drift guard. The whole point of the marker is that trace consumers never need
 * a hand-maintained list of approval-gated tool names — which only holds while
 * every gated tool actually stamps it. Rather than trusting review to catch a
 * new gated tool, find the approval payloads by what they contain and require
 * each one to carry the marker.
 */
describe("approval marker coverage", () => {
  const agentDir = join(__dirname, "..", "..", "..");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "__tests__" ? [] : sourceFiles(path);
      }
      return entry.name.endsWith(".ts") ? [path] : [];
    });
  }

  /**
   * Scan by *behavior*, not filename. Keying off `pending*.ts` would have missed
   * `agent/tools/approval.ts`, which emits an accept payload of its own and had
   * to be patched alongside the pending modules.
   */
  const ACCEPT_EVIDENCE = /acceptedBy:|approvalStatus:|status: "accepted"/;
  const REJECT_EVIDENCE = /status: "rejected"/;
  /** Actually produces tool output, as opposed to describing or parsing it. */
  const EMITS_TOOL_OUTPUT = /addToolOutput\(|AgentClientActionResult/;

  const emitters = sourceFiles(agentDir)
    .map((path) => ({ path, source: readFileSync(path, "utf-8") }))
    .filter(
      ({ source }) =>
        EMITS_TOOL_OUTPUT.test(source) &&
        (ACCEPT_EVIDENCE.test(source) || REJECT_EVIDENCE.test(source))
    );

  it("finds every module that emits an approval payload", () => {
    // Exact, so deleting or renaming an approval path is a visible change here
    // rather than a silently smaller scan.
    expect(emitters.map((e) => e.path.slice(agentDir.length + 1)).sort())
      .toMatchInlineSnapshot(`
        [
          "shared/pendingApproval/bindPendingApproval.ts",
          "tools/approval.ts",
          "tools/batchSpanAnnotate/pendingBatchSpanAnnotate.ts",
          "tools/codeEvaluatorDraft/pendingCodeEvaluatorEdit.ts",
          "tools/llmEvaluatorDraft/pendingLlmEvaluatorEdit.ts",
          "tools/patchExperiment/pendingPatchExperiment.ts",
          "tools/playgroundLoadDataset/pendingLoadDataset.ts",
          "tools/playgroundPrompt/pendingPromptEdit.ts",
          "tools/playgroundPrompt/pendingPromptInstanceRemoval.ts",
          "tools/playgroundPromptTools/pendingPromptToolWrite.ts",
          "tools/playgroundSavePrompt/pendingSavePrompt.ts",
        ]
      `);
  });

  it.each(emitters.map((e) => [e.path, e.source] as const))(
    "%s stamps every approval branch it emits",
    (_path, source) => {
      if (ACCEPT_EVIDENCE.test(source)) {
        expect(source).toContain('decision: "accepted"');
      }
      if (REJECT_EVIDENCE.test(source)) {
        expect(source).toContain('decision: "rejected"');
      }
    }
  );
});
