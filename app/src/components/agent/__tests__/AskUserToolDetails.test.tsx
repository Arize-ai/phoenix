import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AskUserToolDetails,
  formatAskUserState,
  getAskUserToolPreview,
} from "../AskUserToolDetails";
import {
  ElicitationDraftProvider,
  type PendingElicitationDraft,
} from "../ElicitationDraftContext";
import type { ToolInvocationPart } from "../toolPartTypes";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function createAskUserPart(
  overrides: Partial<ToolInvocationPart> = {}
): ToolInvocationPart {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fixture for the tool-ask_user member of the SDK's discriminated ToolInvocationPart union with Partial overrides
  return {
    type: "tool-ask_user",
    toolCallId: "tool-call-1",
    state: "input-streaming",
    input: {},
    output: undefined,
    errorText: undefined,
    ...overrides,
  } as ToolInvocationPart;
}

function renderAskUserToolDetails({
  part,
  draft = null,
}: {
  part: ToolInvocationPart;
  draft?: PendingElicitationDraft | null;
}) {
  act(() => {
    root.render(
      <ElicitationDraftProvider draft={draft}>
        <AskUserToolDetails part={part} />
      </ElicitationDraftProvider>
    );
  });
}

function getAnswerRows() {
  return Array.from(
    container.querySelectorAll(".ask-user__list-line[data-status]")
  ).map((row) => ({
    status: row.getAttribute("data-status"),
    text: row.querySelector(".ask-user__list-text")?.textContent?.trim() ?? "",
  }));
}

describe("AskUserToolDetails", () => {
  it("keeps missing questions in a pending state while the tool is streaming", () => {
    const part = createAskUserPart({
      state: "input-streaming",
      input: {},
    });

    expect(getAskUserToolPreview(part)).toBe("Question pending");
    expect(formatAskUserState(part.state, part)).toBe("Preparing questions");
  });

  it("treats a completed ask_user call without output as awaiting a response", () => {
    const part = createAskUserPart({
      state: "output-available",
      input: {
        questions: [
          {
            id: "question-1",
            prompt: "Which option should we use?",
            type: "freeform",
          },
        ],
      },
    });

    expect(getAskUserToolPreview(part)).toBe("1 question");
    expect(formatAskUserState(part.state, part)).toBe("Awaiting response");
  });

  it("only reports an error for missing questions on the error path", () => {
    const part = createAskUserPart({
      state: "output-error",
      input: {},
      errorText: "Failed to parse questions",
    });

    expect(getAskUserToolPreview(part)).toBe("");
    expect(formatAskUserState(part.state, part)).toBe("Error");
  });

  it("renders in-progress draft answers in the expanded view", () => {
    const part = createAskUserPart({
      state: "input-available",
      input: {
        questions: [
          {
            id: "question-1",
            prompt: "Choose a provider",
            type: "single",
            allow_skip: false,
            allow_freeform: false,
            options: [
              { id: "openai", label: "OpenAI" },
              { id: "anthropic", label: "Anthropic" },
            ],
          },
          {
            id: "question-2",
            prompt: "Anything else?",
            type: "freeform",
            allow_skip: false,
            allow_freeform: false,
          },
        ],
      },
    });

    renderAskUserToolDetails({
      part,
      draft: {
        toolCallId: part.toolCallId,
        answers: {
          "question-1": ["anthropic"],
          "question-2": "Use the lowest latency option.",
        },
        freeformTexts: {},
        currentIndex: 1,
      },
    });

    expect(container.textContent).toContain("Choose a provider");
    expect(container.textContent).toContain("Anything else?");
    expect(container.textContent).toContain("Anthropic");
    expect(container.textContent).toContain("Use the lowest latency option.");
    expect(getAnswerRows()).toEqual([
      { status: "answered", text: "Anthropic" },
      { status: "answered", text: "Use the lowest latency option." },
    ]);
  });

  it("renders blank custom selections as subdued left blank text", () => {
    const part = createAskUserPart({
      state: "input-available",
      input: {
        questions: [
          {
            id: "question-1",
            prompt: "Choose a provider",
            type: "single",
            allow_skip: false,
            allow_freeform: true,
            options: [{ id: "openai", label: "OpenAI" }],
          },
        ],
      },
    });

    renderAskUserToolDetails({
      part,
      draft: {
        toolCallId: part.toolCallId,
        answers: {
          "question-1": ["__freeform__"],
        },
        freeformTexts: {},
        currentIndex: 0,
      },
    });

    const subduedAnswer = Array.from(
      container.querySelectorAll(".ask-user__list-text")
    ).find((node) => node.textContent?.trim() === "(left blank)");

    expect(subduedAnswer).toBeDefined();
    expect(subduedAnswer?.getAttribute("data-subdued")).toBe("true");
    expect(getAnswerRows()).toEqual([
      { status: "answered", text: "(left blank)" },
    ]);
  });

  it("distinguishes current and pending unanswered questions in the rendered answers", () => {
    const part = createAskUserPart({
      state: "input-available",
      input: {
        questions: [
          {
            id: "question-1",
            prompt: "Choose a provider",
            type: "single",
            options: [{ id: "openai", label: "OpenAI" }],
            allow_skip: false,
            allow_freeform: false,
          },
          {
            id: "question-2",
            prompt: "Add extra context",
            type: "freeform",
            allow_skip: false,
            allow_freeform: false,
          },
        ],
      },
    });

    renderAskUserToolDetails({
      part,
      draft: {
        toolCallId: part.toolCallId,
        answers: {},
        freeformTexts: {},
        currentIndex: 0,
      },
    });

    expect(getAnswerRows()).toEqual([
      { status: "current", text: "No options selected yet" },
      { status: "pending", text: "Waiting for input" },
    ]);
  });

  it("marks unanswered final questions as skipped in the rendered answers", () => {
    const part = createAskUserPart({
      state: "output-available",
      input: {
        questions: [
          {
            id: "question-1",
            prompt: "Choose a provider",
            type: "single",
            options: [{ id: "openai", label: "OpenAI" }],
            allow_skip: true,
            allow_freeform: false,
          },
        ],
      },
      output: {
        answers: {},
        freeformTexts: {},
      },
    });

    renderAskUserToolDetails({ part });

    const skippedAnswer = Array.from(
      container.querySelectorAll(".ask-user__list-text")
    ).find((node) => node.textContent?.trim() === "Skipped");

    expect(getAnswerRows()).toEqual([{ status: "skipped", text: "Skipped" }]);
    expect(skippedAnswer?.getAttribute("data-subdued")).toBe("true");
  });
});
