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
    const toolPayload = { status: "saved", approval: "not-the-marker" };
    const output = {
      ...toolPayload,
      ...approvalOutcome({ decision: "accepted", source: "auto" }),
    };
    expect(output.approval).toEqual({ decision: "accepted", source: "auto" });
  });
});

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

  const ACCEPT_EVIDENCE = /acceptedBy:|approvalStatus:|status: "accepted"/;
  const REJECT_EVIDENCE = /status: "rejected"/;
  const EMITS_TOOL_OUTPUT = /addToolOutput\(|AgentClientActionResult/;

  const emitters = sourceFiles(agentDir)
    .map((path) => ({ path, source: readFileSync(path, "utf-8") }))
    .filter(
      ({ source }) =>
        EMITS_TOOL_OUTPUT.test(source) &&
        (ACCEPT_EVIDENCE.test(source) || REJECT_EVIDENCE.test(source))
    );

  it("finds every module that emits an approval payload", () => {
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
