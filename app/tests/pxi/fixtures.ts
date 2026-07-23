import { expect, test as base } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";

import { DOCS_TOOL_NAMES } from "../../src/agent/tools/docs";
import {
  DEFAULT_ASSISTANT_MODEL,
  DEFAULT_ASSISTANT_PROJECT_NAME,
  DEFAULT_ASSISTANT_PROVIDER,
  DEFAULT_JUDGE_MODEL,
} from "./constants";
import type { PxiTurn } from "./types";
import { expectOK, getSpanToolName, getUiMessageToolNames } from "./utils";

export type { PxiTurn } from "./types";

type LatestAssistantTurn = Omit<PxiTurn, "durationMs"> & {
  parts: unknown[];
};

function getAssistantProvider() {
  return process.env.PXI_E2E_ASSISTANT_PROVIDER ?? DEFAULT_ASSISTANT_PROVIDER;
}

function getAssistantModel() {
  return process.env.PXI_E2E_ASSISTANT_MODEL ?? DEFAULT_ASSISTANT_MODEL;
}

function getJudgeModel() {
  return process.env.PXI_E2E_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;
}

function getJudgeProvider() {
  const [provider] = getJudgeModel().split("/");
  return provider?.toUpperCase() ?? "OPENAI";
}

function getAssistantProjectName() {
  return (
    process.env.PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME ??
    DEFAULT_ASSISTANT_PROJECT_NAME
  );
}

async function installAgentDefaults({ page }: { page: Page }) {
  const assistantProvider = getAssistantProvider();
  const assistantModel = getAssistantModel();
  await page.addInitScript(
    ({ provider, modelName }) => {
      localStorage.clear();
      localStorage.setItem(
        "arize-phoenix-feature-flags",
        JSON.stringify({ agents: true, tracing_ux: false })
      );
      // Write the canonical v0 partialize shape directly so the fixture does
      // not depend on the store's migrate path. The store's version is
      // tracked in app/src/store/agentStore.ts (`persist({ version })`); keep
      // this fixture in sync when bumping the schema version, otherwise the
      // migrate-forced field values silently override what the fixture
      // intends to set.
      localStorage.setItem(
        "arize-phoenix-assistant",
        JSON.stringify({
          state: {
            isOpen: false,
            position: "pinned",
            fabPlacement: "bottom-end",
            sessions: [],
            activeSessionId: null,
            sessionMap: {},
            defaultModelConfig: {
              provider,
              modelName,
              invocationParameters: [],
              supportedInvocationParameters: [],
            },
            observability: {
              storeLocalTraces: true,
              exportRemoteTraces: false,
              hasAcknowledgedConsent: false,
            },
            capabilities: {
              "bash.retainInactiveSessions": false,
              "graphql.mutations": false,
              "session.storeSessions": false,
              "web.access": false,
            },
          },
          version: 0,
        })
      );
    },
    {
      provider: assistantProvider,
      modelName: assistantModel,
    }
  );
}

export class PxiDriver {
  private page: Page;
  private request: APIRequestContext;

  constructor({
    page,
    request,
  }: {
    page: Page;
    request: APIRequestContext;
    testInfo: TestInfo;
  }) {
    this.page = page;
    this.request = request;
  }

  async open() {
    await installAgentDefaults({ page: this.page });
    await this.page.goto("/projects");
    await this.page.getByRole("button", { name: "Open assistant" }).click();
    await expect(
      this.page.getByRole("heading", {
        name: "Meet PXI, your Phoenix assistant",
      })
    ).toBeVisible();
  }

  async acknowledgeConsent() {
    const acknowledgeButton = this.page.getByRole("button", {
      name: "Acknowledge",
    });
    if (await acknowledgeButton.isVisible()) {
      await acknowledgeButton.click();
    }
    await expect(this.page.getByLabel("Message input")).toBeVisible();
  }

  async askAndWait(message: string) {
    const startedAt = Date.now();
    await this.page.getByLabel("Message input").fill(message);
    await this.page.getByRole("button", { name: "Send message" }).click();
    const turn = await this.getLatestAssistantTurn();
    return {
      ...turn,
      durationMs: Date.now() - startedAt,
    };
  }

  async getLatestAssistantTurn(): Promise<LatestAssistantTurn> {
    const turnHandle = await this.page.waitForFunction(() => {
      const stored = localStorage.getItem("arize-phoenix-assistant");
      if (!stored) {
        return null;
      }
      const parsed: {
        state?: {
          activeSessionId?: string | null;
          sessionMap?: Record<
            string,
            {
              messages?: Array<{
                role?: string;
                parts?: unknown[];
                metadata?: {
                  trace?: {
                    traceId?: unknown;
                  } | null;
                };
              }>;
            }
          >;
        };
      } = JSON.parse(stored);
      const activeSessionId = parsed.state?.activeSessionId;
      if (!activeSessionId) {
        return null;
      }
      const messages = parsed.state?.sessionMap?.[activeSessionId]?.messages;
      const assistantMessages = (messages ?? []).filter(
        (candidate) => candidate.role === "assistant"
      );
      const latestAssistant = assistantMessages.at(-1);
      const traceId = latestAssistant?.metadata?.trace?.traceId;
      if (typeof traceId !== "string") {
        return null;
      }
      const assistantText = (latestAssistant?.parts ?? [])
        .map((part) => {
          if (typeof part !== "object" || part === null) return "";
          const candidate = part as { type?: unknown; text?: unknown };
          return candidate.type === "text" && typeof candidate.text === "string"
            ? candidate.text
            : "";
        })
        .join("");
      if (!assistantText) {
        return null;
      }
      return { assistantText, parts: latestAssistant?.parts ?? [], traceId };
    });
    const turn = await turnHandle.jsonValue();
    if (turn === null) {
      throw new Error("Expected an assistant turn payload to be available");
    }
    const calledTools = await this.getToolNamesForTrace(turn.traceId);
    const uiCalledTools = getUiMessageToolNames(turn.parts);
    return {
      ...turn,
      calledTools: [...new Set([...calledTools, ...uiCalledTools])],
    };
  }

  async expectBackendToolSpanCalled(turn: PxiTurn): Promise<string[]> {
    await expect
      .poll(
        async () => (await this.getToolNamesForTrace(turn.traceId)).length,
        {
          message:
            "Expected persisted PXI trace to include a backend TOOL span for the PXI request.",
        }
      )
      .toBeGreaterThan(0);
    const backendCalledTools = await this.getToolNamesForTrace(turn.traceId);
    return [...new Set([...turn.calledTools, ...backendCalledTools])];
  }

  async expectNoAgentError() {
    await expect(this.page.locator(".chat__error")).toHaveCount(0);
  }

  expectDocsToolCalled(turn: PxiTurn) {
    const hasCalledDocsTool = turn.calledTools.some((toolName) =>
      (DOCS_TOOL_NAMES as readonly string[]).includes(toolName)
    );
    expect(
      hasCalledDocsTool,
      `Expected the PXI trace to include a documentation tool call (${DOCS_TOOL_NAMES.join(
        ", "
      )}). This assertion is intentionally coupled to Phoenix's current docs tool prompt contract; if those tool names change, update the smoke test alongside the prompt. Called tools: ${turn.calledTools.join(
        ", "
      )}`
    ).toBe(true);
  }

  getMetadata() {
    return {
      assistantProvider: getAssistantProvider(),
      assistantModel: getAssistantModel(),
      judgeProvider: getJudgeProvider(),
      judgeModel: getJudgeModel(),
    };
  }

  private async getToolNamesForTrace(traceId: string): Promise<string[]> {
    const projectName = encodeURIComponent(getAssistantProjectName());
    const response = await expectOK(
      await this.request.get(`/v1/projects/${projectName}/spans`, {
        params: {
          trace_id: traceId,
          span_kind: "TOOL",
        },
      })
    );
    const spans = response.data;
    if (!Array.isArray(spans)) {
      return [];
    }
    return spans.flatMap((span) => {
      const toolName = getSpanToolName(span);
      return toolName ? [toolName] : [];
    });
  }

  async getActiveSessionId(): Promise<string> {
    const handle = await this.page.waitForFunction(() => {
      const stored = localStorage.getItem("arize-phoenix-assistant");
      if (!stored) return null;
      const parsed: {
        state?: { activeSessionId?: string | null };
      } = JSON.parse(stored);
      return parsed.state?.activeSessionId ?? null;
    });
    const activeSessionId = await handle.jsonValue();
    if (activeSessionId === null) {
      throw new Error("Expected an active session id to be available");
    }
    return activeSessionId;
  }

  async listRecentProjectTraces(sinceIsoTimestamp: string): Promise<
    Array<{
      trace_id: string;
      spans: Array<{ span_kind: string; name: string }>;
    }>
  > {
    const projectName = encodeURIComponent(getAssistantProjectName());
    const response = await expectOK(
      await this.request.get(`/v1/projects/${projectName}/traces`, {
        params: {
          start_time: sinceIsoTimestamp,
          include_spans: "true",
          limit: 50,
        },
      })
    );
    const traces = response.data;
    return Array.isArray(traces) ? traces : [];
  }
}

export const test = base.extend<{ pxi: PxiDriver }>({
  pxi: async ({ page, request }, provide, testInfo) => {
    await provide(new PxiDriver({ page, request, testInfo }));
  },
});

/**
 * Backwards-compatible alias for tests that previously opted into the v2
 * endpoint. There is now a single chat endpoint, so this is just `test`.
 */
export const testV2 = test;

export { expect };
