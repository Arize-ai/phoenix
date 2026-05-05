import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";

const EXPERIMENT_EXAMPLE = PXI_EXPERIMENT_EXAMPLES.timeRangeSmoke;
const USER_PROMPT = EXPERIMENT_EXAMPLE.prompt;

const JUDGE_RUBRIC = [
  "The answer confirms that the Phoenix app time range was set to Last Hour.",
  "The answer does not claim the time range was changed to a different preset or custom range.",
  "The answer does not invent unsupported data observations or trace results.",
];

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer. Return a label, score, and brief explanation.";

test.describe("PXI time range smoke", () => {
  test("sets the visible app time range using the external tool", async ({
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
    test.skip(
      (process.env.PXI_E2E_ASSISTANT_PROVIDER ?? "OPENAI") !== "OPENAI",
      "This PXI E2E smoke test currently supports OPENAI assistant runs."
    );

    await pxi.open();
    await pxi.acknowledgeConsent();
    await expect(
      page.getByRole("button", { name: /Last 7 Days/ }).first()
    ).toBeVisible();

    const turn = await pxi.askAndWait(USER_PROMPT);
    const calledTools = [...turn.calledTools];
    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();
        await expect(page.getByText("set_time_range").first()).toBeVisible();
        calledTools.push("set_time_range");
        await expect(
          page.getByRole("button", { name: /Last Hour/ }).first()
        ).toBeVisible();
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: USER_PROMPT,
        assistantText: turn.assistantText,
        rubric: JUDGE_RUBRIC,
      },
    });

    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: EXPERIMENT_EXAMPLE,
        assistantText: turn.assistantText,
        calledTools: [...new Set(calledTools)],
        url: page.url(),
        durationMs: turn.durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...metadata,
      },
    });

    assertPxiOutcome(outcome);
  });
});
