import { persistPxiExperiment } from "./experimentPersistence";
import { expect, test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv, judge } from "./judge";

const AGENT_USER_INSTRUCTIONS =
  "Use the Phoenix documentation tools when the user asks about Phoenix documentation.";

const USER_PROMPT =
  "Use the Phoenix documentation to answer: what environment variable controls the project name for Phoenix tracing? Include a link to the relevant Phoenix docs.";

const JUDGE_RUBRIC = [
  "The answer is grounded in Phoenix documentation.",
  "The answer identifies PHOENIX_PROJECT_NAME as the environment variable for setting the Phoenix tracing project name.",
  "The answer includes a canonical arize.com/docs/phoenix documentation link.",
  "The answer does not invent or recommend a different environment variable.",
];

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer. Return a label, score, and brief explanation.";

test.describe("PXI docs smoke", () => {
  test("answers tracing project env var using runtime Mintlify MCP docs", async ({
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
      "This MVP PXI E2E test currently supports OPENAI assistant runs."
    );

    await pxi.open({ userInstructions: AGENT_USER_INSTRUCTIONS });
    await pxi.acknowledgeConsent();

    const turn = await pxi.askAndWait(USER_PROMPT);
    await pxi.expectNoAgentError();
    pxi.expectDocsToolCalled(turn);
    expect(turn.assistantText).toContain("PHOENIX_PROJECT_NAME");

    const judgeResult = await judge({
      system: JUDGE_SYSTEM,
      prompt: USER_PROMPT,
      assistantText: turn.assistantText,
      rubric: JUDGE_RUBRIC,
    });

    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        prompt: USER_PROMPT,
        assistantText: turn.assistantText,
        calledTools: turn.calledTools,
        url: page.url(),
        durationMs: turn.durationMs,
        judgeResult,
        playwrightProject: testInfo.project.name,
        ...metadata,
      },
    });

    expect(judgeResult.label, judgeResult.explanation).toBe("pass");
  });
});
