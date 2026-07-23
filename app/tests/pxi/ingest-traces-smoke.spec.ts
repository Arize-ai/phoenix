import {
  persistPxiExperiment,
  PXI_EXPERIMENT_EXAMPLES,
} from "./experimentPersistence";
import { expect, test } from "./fixtures";
import { getRequiredJudgeApiKeyEnv } from "./judge";
import { assertPxiOutcome, evaluatePxiOutcome } from "./outcome";

const EXPERIMENT_EXAMPLE = PXI_EXPERIMENT_EXAMPLES.ingestTracesSmoke;
const USER_PROMPT = EXPERIMENT_EXAMPLE.prompt;

// This smoke test validates ingestion plumbing (chat + summary traces persist
// to the assistant project), not response quality. Keep the rubric trivial.
const JUDGE_RUBRIC = ["The assistant produced a non-empty response."];

const JUDGE_SYSTEM =
  "You are judging a Phoenix PXI E2E answer. Return a label, score, and brief explanation.";

// Empirical lower bounds. The chat turn produces an AGENT root span + at least
// one LLM child. The summary turn calls model.request() directly (no agent),
// so it produces only LLM span(s). We assert >= rather than equality to stay
// stable across pydantic-ai's internal retry/finalization behavior.
const MIN_CHAT_SPAN_COUNT = 2;
const MIN_SUMMARY_SPAN_COUNT = 1;

type TraceWithSpans = {
  trace_id: string;
  spans: Array<{ span_kind: string; name: string }>;
};

function classifyTraces(traces: TraceWithSpans[]) {
  const chatTrace = traces.find((t) =>
    t.spans.some((s) => s.span_kind === "AGENT")
  );
  const summaryTrace = traces.find(
    (t) =>
      t !== chatTrace &&
      t.spans.length > 0 &&
      !t.spans.some((s) => s.span_kind === "AGENT")
  );
  return { chatTrace, summaryTrace };
}

test.describe("PXI ingest traces smoke", () => {
  test("persists chat and summary traces locally to the assistant project", async ({
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

    // Real LLM round-trip + auto-summary + DB poll + judge can exceed the
    // 45s default. Give the whole test plenty of room.
    test.setTimeout(180_000);

    await pxi.open();
    await pxi.acknowledgeConsent();

    // Drive the chat turn directly without going through the harness's
    // askAndWait, which depends on assistant-message traceId metadata that
    // the new chat route does not yet emit. Wait for the assistant turn to
    // finish by polling localStorage for the latest assistant message.
    const startedAt = Date.now();
    await page.getByLabel("Message input").fill(USER_PROMPT);
    await page.getByRole("button", { name: "Send message" }).click();

    const assistantTextHandle = await page.waitForFunction(
      () => {
        const stored = localStorage.getItem("arize-phoenix-assistant");
        if (!stored) return null;
        const parsed: {
          state?: {
            activeSessionId?: string | null;
            sessionMap?: Record<
              string,
              { messages?: Array<{ role?: string; parts?: unknown[] }> }
            >;
          };
        } = JSON.parse(stored);
        const sid = parsed.state?.activeSessionId;
        if (!sid) return null;
        const msgs = parsed.state?.sessionMap?.[sid]?.messages ?? [];
        const lastAssistant = [...msgs]
          .reverse()
          .find((m) => m.role === "assistant");
        if (!lastAssistant) return null;
        const text = (lastAssistant.parts ?? [])
          .map((part) => {
            if (typeof part !== "object" || part === null) return "";
            const p = part as { type?: unknown; text?: unknown };
            return p.type === "text" && typeof p.text === "string"
              ? p.text
              : "";
          })
          .join("");
        return text || null;
      },
      undefined,
      { timeout: 60_000 }
    );
    const assistantText = await assistantTextHandle.jsonValue();
    if (assistantText === null) {
      throw new Error("Expected assistant text to be available");
    }
    const durationMs = Date.now() - startedAt;
    // Bracket the trace lookup by the wall-clock window of this test run so
    // we don't pick up traces from prior runs accumulated in the project.
    const sinceIso = new Date(startedAt - 1_000).toISOString();

    let chatTrace: TraceWithSpans | undefined;
    let summaryTrace: TraceWithSpans | undefined;

    const outcome = await evaluatePxiOutcome({
      assertions: async () => {
        await pxi.expectNoAgentError();

        // Poll the project's traces (filtered by start_time so we only see
        // traces from this run) until both the chat trace (AGENT root) and
        // the auto-fired summary trace (LLM only) have been persisted.
        await expect
          .poll(
            async () => {
              const traces = (await pxi.listRecentProjectTraces(
                sinceIso
              )) as TraceWithSpans[];
              const classified = classifyTraces(traces);
              chatTrace = classified.chatTrace;
              summaryTrace = classified.summaryTrace;
              return Boolean(chatTrace && summaryTrace);
            },
            {
              message:
                "Expected both the chat trace (AGENT root) and the summary trace to be persisted to the assistant project.",
              timeout: 60_000,
            }
          )
          .toBe(true);

        expect(chatTrace, "chat trace should be present").toBeDefined();
        expect(summaryTrace, "summary trace should be present").toBeDefined();

        expect(chatTrace!.spans.length).toBeGreaterThanOrEqual(
          MIN_CHAT_SPAN_COUNT
        );
        expect(summaryTrace!.spans.length).toBeGreaterThanOrEqual(
          MIN_SUMMARY_SPAN_COUNT
        );
      },
      judgeInput: {
        system: JUDGE_SYSTEM,
        prompt: USER_PROMPT,
        assistantText,
        rubric: JUDGE_RUBRIC,
      },
    });

    const metadata = pxi.getMetadata();
    await persistPxiExperiment({
      request,
      record: {
        example: EXPERIMENT_EXAMPLE,
        assistantText,
        calledTools: [],
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
