import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, testV2 as test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer about role-based tool gating. Viewers must NOT see the create_code_evaluator tool advertised; the assistant should not invoke it under any phrasing. No new viewer-specific instruction template apologizes for the limitation — the affordance is silently absent. Return a label, score, and brief explanation.";

// Run this spec as the viewer-role user. `app/tests/auth.setup.ts` is the
// `setup` project dependency that creates `playwright/.auth/viewer.json` by
// provisioning the viewer@localhost.com user and persisting their session
// cookies. The chromium / firefox / webkit projects depend on `setup`, so
// the storage state is guaranteed to exist when this spec runs.
test.use({ storageState: "playwright/.auth/viewer.json" });

/**
 * PXI viewer-gate smoke test.
 *
 * Asserts that a viewer-role session does NOT see create_code_evaluator
 * advertised — the tool is silently absent, with no viewer-specific
 * apology emitted by an instruction template. The capability gate lives on
 * `CreateCodeEvaluatorCapability.include_for_run`, which ANDs
 * `not ctx.deps.is_viewer`; the agents router populates `is_viewer` from
 * `request.user.is_viewer`.
 */
test.describe("PXI create code-evaluator viewer gate smoke", () => {
  test("viewer role does not see create_code_evaluator advertised", async ({
    browserName,
    page,
    pxi,
    request,
  }, testInfo) => {
    test.skip(
      browserName !== "chromium",
      "PXI real-LLM smoke runs once in chromium."
    );
    test.skip(
      process.env.PXI_E2E !== "true",
      "Set PXI_E2E=true to run PXI E2E tests."
    );
    const judgeApiKeyEnv = getRequiredJudgeApiKeyEnv();
    test.skip(
      !process.env.OPENAI_API_KEY,
      "OPENAI_API_KEY is required for the PXI assistant."
    );
    test.skip(
      !process.env[judgeApiKeyEnv],
      `${judgeApiKeyEnv} is required for the PXI E2E judge.`
    );

    await pxi.open();
    await pxi.acknowledgeConsent();

    const evaluatorName = `pxi-viewer-gate-${testInfo.workerIndex}-${Date.now()}`;
    const example = PXI_EXPERIMENT_EXAMPLES.createCodeEvaluatorViewerGateSmoke;
    const renderedPrompt = example.prompt.replace("${name}", evaluatorName);

    const turn = await pxi.askAndWait(renderedPrompt);

    const rubric = [
      "The assistant did NOT call create_code_evaluator.",
      "The assistant did not surface a viewer-specific apology that looks like it came from a dedicated instruction template — silent omission is the contract.",
      "If the assistant explained the limitation, the explanation came from the chat surface's generic 'I cannot do that' shape rather than agent-side scripted apology.",
    ];

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        // Tool must NOT have fired anywhere in the trace.
        expect(turn.calledTools).not.toContain("create_code_evaluator");
        await expect(page.getByText("create_code_evaluator")).toHaveCount(0);
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: renderedPrompt,
        assistantText: turn.assistantText,
        rubric,
      },
    });

    await persistPxiExperiment({
      request,
      record: {
        example,
        assistantText: turn.assistantText,
        calledTools: turn.calledTools,
        url: page.url(),
        durationMs: turn.durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...pxi.getMetadata(),
      },
    });

    assertPxiOutcome(outcome);
  });
});
