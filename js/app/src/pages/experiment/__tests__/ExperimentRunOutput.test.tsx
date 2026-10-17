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

async function renderOutput(error: string | null) {
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <ExperimentRunOutput
          id="run-1"
          error={error}
          output={{ message: "normal output retained" }}
          annotations={{ edges: [] }}
          costSummary={{ total: { cost: null, tokens: null } }}
          latencyMs={0}
          repetitionNumber={1}
          trace={null}
          numRepetitions={1}
          onOpenTraceDetails={() => {}}
          annotationSummaries={[]}
          annotationConfigs={[]}
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
    {
      name: "array with surrounding whitespace",
      input: '  [{"code":"timeout"},null]  ',
      expected: '[\n  {\n    "code": "timeout"\n  },\n  null\n]',
    },
    {
      name: "whitespace inside a string",
      input: '{"text":"a  b"}',
      expected: '{\n  "text": "a  b"\n}',
    },
    { name: "null", input: "null", expected: "null" },
    { name: "false", input: "false", expected: "false" },
    { name: "zero", input: "0", expected: "0" },
    { name: "string", input: '"timeout"', expected: '"timeout"' },
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
    { name: "plain text", input: "Synthetic timeout" },
    {
      name: "real newlines and indentation",
      input:
        "RuntimeError: timeout\n  at local_demo.py:42\n    diagnostic detail",
    },
    {
      name: "steps without newlines",
      input: "FAILURE | STEPS: (1) Read the input (2) Record the mismatch",
    },
    { name: "malformed JSON", input: '{"error":"timeout", trailing}' },
    { name: "prefixed JSON", input: 'Error: {"code":"timeout"}' },
    {
      name: "literal backslash-n",
      input: String.raw`RuntimeError('first line\n  second line')`,
    },
    { name: "whitespace", input: "  \n\t " },
  ])("preserves $name verbatim", async ({ input }) => {
    await renderError(input);
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toBe(input);
    expect(getComputedStyle(pre!).whiteSpace).toBe("pre-wrap");
    expect(getComputedStyle(pre!).overflowWrap).toBe("anywhere");
    expect(container.querySelector(".cm-editor")).toBeNull();
  });

  it.each([
    '{"request_id":12345678901234567890}',
    "1e999",
    '{"a":1,"a":2}',
    "-0",
    "1.0",
    String.raw`{"text":"a\tb","escaped":"\u0061"}`,
    '{"2":"second","1":"first"}',
  ])(
    "preserves JSON tokens when formatting would change them: %s",
    async (input) => {
      await renderError(input);
      expect(jsonText()).toBe(input);
      expect(container.querySelector("pre")).toBeNull();
    }
  );

  it.each([null, ""])("renders normal output for error %s", async (error) => {
    await renderOutput(error);
    expect(container.querySelector('[aria-label="Error"]')).toBeNull();
    expect(container.textContent).toContain("normal output retained");
  });
});
