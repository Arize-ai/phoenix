import type { Page } from "@playwright/test";

import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";
import { getUiMessageToolNames } from "./utils";

const EXPERIMENT_EXAMPLE = PXI_EXPERIMENT_EXAMPLES.routeLinkSmoke;
const USER_PROMPT = EXPERIMENT_EXAMPLE.prompt;
const REQUIRED_LINK = "/settings/data";
const ROUTE_INFO_TOOL_NAME = "get_route_info";

const JUDGE_RUBRIC = [
  "The answer helps the user navigate to Phoenix data retention policy configuration.",
  "The answer includes a markdown link to /settings/data.",
  "The answer does not include an absolute localhost, 127.0.0.1, or external app URL for the Phoenix UI link.",
];

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer. Return a label, score, and brief explanation.";

async function waitForLatestAssistantTurnWithText(page: Page) {
  const turnHandle = await page.waitForFunction(() => {
    const stored = localStorage.getItem("arize-phoenix-assistant");
    if (!stored) {
      return null;
    }
    const parsed: {
      state?: {
        activeSessionId?: string | null;
        sessionMap?: Record<
          string,
          { messages?: Array<{ role?: string; parts?: unknown[] }> }
        >;
      };
    } = JSON.parse(stored);
    const activeSessionId = parsed.state?.activeSessionId;
    if (!activeSessionId) {
      return null;
    }
    const messages =
      parsed.state?.sessionMap?.[activeSessionId]?.messages ?? [];
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!latestAssistant) {
      return null;
    }
    const assistantText = (latestAssistant.parts ?? [])
      .map((part) => {
        if (typeof part !== "object" || part === null) {
          return "";
        }
        const candidate = part as { type?: unknown; text?: unknown };
        return candidate.type === "text" && typeof candidate.text === "string"
          ? candidate.text
          : "";
      })
      .join("");
    if (!assistantText) {
      return null;
    }
    return { assistantText, parts: latestAssistant.parts ?? [] };
  });
  const turn = await turnHandle.jsonValue();
  if (turn === null) {
    throw new Error("Expected an assistant turn payload to be available");
  }
  return turn;
}

test.describe("PXI route link smoke", () => {
  test("uses route info to link to data retention settings", async ({
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

    test.setTimeout(180_000);

    await pxi.open();
    await pxi.acknowledgeConsent();

    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(USER_PROMPT);
    await page.getByRole("button", { name: "Send message" }).click();
    const turn = await waitForLatestAssistantTurnWithText(page);
    const durationMs = Date.now() - startedAt;
    const calledTools = getUiMessageToolNames(turn.parts);

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();
        expect(calledTools).toContain(ROUTE_INFO_TOOL_NAME);
        expect(turn.assistantText).toContain(`](${REQUIRED_LINK})`);
        expect(turn.assistantText).not.toMatch(
          /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i
        );
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
        calledTools,
        url: page.url(),
        durationMs,
        judgeResult: outcome.judgeResult,
        playwrightProject: testInfo.project.name,
        ...metadata,
      },
    });

    assertPxiOutcome(outcome);
  });
});
