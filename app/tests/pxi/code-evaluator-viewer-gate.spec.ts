import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, testV2 as test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer about role-based tool gating. Viewers must NOT see the create_code_evaluator tool advertised; the assistant should not invoke it under any phrasing. No new viewer-specific instruction template apologizes for the limitation — the affordance is silently absent. Return a label, score, and brief explanation.";

/**
 * PXI viewer-gate smoke test.
 *
 * Asserts that a viewer-role session does NOT see create_code_evaluator
 * advertised (D7 viewer denial path — silent omission, no viewer-specific
 * instruction template apology). The capability gate lives on
 * `CreateCodeEvaluatorCapability.include_for_run`, which now ANDs
 * `not ctx.deps.is_viewer`. The agents router populates `is_viewer` from
 * `request.user.is_viewer` with an isinstance(PhoenixUser) guard.
 *
 * Gated with `test.fixme()` pending the harness fix tracked at
 * https://github.com/Arize-ai/phoenix/issues/TBD — the body encodes the
 * viewer-login plumbing + rubric so the contract ships with the rework.
 */
test.describe("PXI create code-evaluator viewer gate smoke", () => {
  test.fixme(
    "viewer role does not see create_code_evaluator advertised",
    async ({ browserName, page, pxi, request }, testInfo) => {
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
      test.skip(
        !process.env.PXI_E2E_VIEWER_BEARER_TOKEN,
        "PXI_E2E_VIEWER_BEARER_TOKEN is required for the viewer-role gate test. Provision a viewer-role access token from the Phoenix auth backend before running."
      );

      // Authenticate as the viewer-role user. The bearer token must be issued
      // by the Phoenix auth backend with a user_role=VIEWER claim — this is
      // what PhoenixUser.is_viewer reads.
      await page.context().setExtraHTTPHeaders({
        Authorization: `Bearer ${process.env.PXI_E2E_VIEWER_BEARER_TOKEN}`,
      });

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
    }
  );
});
