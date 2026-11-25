import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { ThemeProvider } from "@phoenix/contexts";

import { ExperimentRunOutput } from "../ExperimentCompareTable";

installTestMatchMedia();
installTestStorage();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderOutput(
  error: string | null,
  output: object = { message: "normal output retained" }
) {
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <ExperimentRunOutput
          id="run-1"
          error={error}
          output={output}
          annotations={{ edges: [] }}
          costSummary={{ total: { cost: null, tokens: null } }}
          latencyMs={0}
          repetitionNumber={1}
          trace={null}
          numRepetitions={1}
          onOpenTraceDetails={() => {}}
          annotationSummaries={[]}
          annotationConfigs={[]}
          decisionQuestions={null}
          height={300}
        />
      </ThemeProvider>
    );
  });
}

async function renderError(error: string) {
  await renderOutput(error);
  const icon = container.querySelector('[role="img"][aria-label="Error"]');
  expect(icon).not.toBeNull();
  expect(getComputedStyle(icon!).flexShrink).toBe("0");
}

function jsonText() {
  const editor = container.querySelector(".cm-editor");
  expect(editor).not.toBeNull();
  expect(getComputedStyle(editor!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(container.querySelector(".cm-gutters")).toBeNull();
  return Array.from(container.querySelectorAll(".cm-content .cm-line"))
    .map((line) => line.textContent)
    .join("\n");
}

describe("ExperimentRunOutput", () => {
  it.each([
    {
      name: "nested object",
      input: '{"error":{"code":"timeout","retryable":false}}',
      expected:
        '{\n  "error": {\n    "code": "timeout",\n    "retryable": false\n  }\n}',
    },
    { name: "false", input: "false", expected: "false" },
    {
      name: "JSON inside a string without decoding twice",
      input: String.raw`"{\"code\":\"timeout\"}"`,
      expected: String.raw`"{\"code\":\"timeout\"}"`,
    },
  ])("formats $name as JSON", async ({ input, expected }) => {
    await renderError(input);
    expect(jsonText()).toBe(expected);
    expect(container.querySelector("pre")).toBeNull();
    expect(
      container.querySelector(".cm-content")?.getAttribute("contenteditable")
    ).toBe("false");
  });

  it.each([
    {
      name: "real newlines and indentation",
      input:
        "RuntimeError: timeout\n  at local_demo.py:42\n    diagnostic detail",
    },
    { name: "malformed JSON", input: '{"error":"timeout", trailing}' },
    {
      name: "literal backslash-n",
      input: String.raw`RuntimeError('first line\n  second line')`,
    },
  ])("preserves $name verbatim", async ({ input }) => {
    await renderError(input);
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toBe(input);
    expect(getComputedStyle(pre!).whiteSpace).toBe("pre-wrap");
    expect(getComputedStyle(pre!).overflowWrap).toBe("anywhere");
    expect(container.querySelector(".cm-editor")).toBeNull();
  });

  it.each(['{"request_id":12345678901234567890}', '{"a":1,"a":2}', "-0"])(
    "preserves JSON tokens when formatting would change them: %s",
    async (input) => {
      await renderError(input);
      expect(jsonText()).toBe(input);
      expect(container.querySelector("pre")).toBeNull();
    }
  );

  it("renders normal output when there is no error", async () => {
    await renderOutput(null);
    expect(container.querySelector('[aria-label="Error"]')).toBeNull();
    expect(container.textContent).toContain("normal output retained");
  });
});
