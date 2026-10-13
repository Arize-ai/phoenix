import { css } from "@emotion/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { PrettyText } from "../PrettyText";

installTestMatchMedia();
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
  vi.restoreAllMocks();
});

async function renderText({
  text,
  variant = "compact",
}: {
  text: string;
  variant?: "compact" | "code";
}) {
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light">
        <PrettyText variant={variant}>{text}</PrettyText>
      </ThemeProvider>
    );
  });
}

describe("PrettyText compact presentation", () => {
  it.each([
    "{}",
    "[]",
    "null",
    "true",
    "false",
    "0",
    "42",
    '"quoted string"',
    '{"only":"value"}',
    '[1,"two",{}]',
    JSON.stringify({ encoded: "{not valid JSON}" }),
  ])("preserves values without decodable containers: %s", async (text) => {
    await renderText({ text });
    expect(container.querySelector(".pretty-text")?.textContent).toBe(
      JSON.stringify(JSON.parse(text), null, 2)
    );
    expect(
      container.querySelector(".pretty-text")?.classList.contains("font-mono")
    ).toBe(true);
    expect(
      container.querySelector(
        ".cm-editor, [contenteditable], [title], .pretty-text__preview-label"
      )
    ).toBeNull();
  });
  it.each([
    "",
    "A grounded explanation.\nThe source supports the answer.",
    '{"invalid":',
    '<img src=x onerror="alert(1)">',
    "unbroken_".repeat(300),
  ])(
    "uses body typography for plain or malformed text without changing it: %s",
    async (text) => {
      await renderText({ text });
      expect(container.querySelector(".pretty-text")?.textContent).toBe(text);
      expect(
        container
          .querySelector(".pretty-text")
          ?.classList.contains("font-default")
      ).toBe(true);
      expect(
        container.querySelector("img, script, .cm-editor, pre")
      ).toBeNull();
    }
  );
  it("keeps existing code presentation available without opting in", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light">
          <PrettyText>{'{"reason":"ok"}'}</PrettyText>
        </ThemeProvider>
      );
    });
    expect(container.querySelector(".cm-content")?.textContent).toContain(
      '"reason": "ok"'
    );
    await renderText({ text: "Existing code text", variant: "code" });
    expect(container.querySelector("pre")?.textContent).toBe(
      "Existing code text"
    );
  });
  it("clearly labels valid nested display decoding without mutating source strings", async () => {
    const source = {
      payload: JSON.stringify({
        items: [JSON.stringify({ reason: "grounded", score: 1 })],
      }),
    };
    const text = JSON.stringify(source);
    await renderText({ text });
    expect(container.querySelector(".pretty-text")?.textContent).toBe(
      JSON.stringify(
        { payload: { items: [{ reason: "grounded", score: 1 }] } },
        null,
        2
      )
    );
    expect(
      container.querySelector(".pretty-text__preview-label")?.textContent
    ).toBe("JSON preview · encoded strings decoded");
    expect(container.querySelector("[tabindex], button, [title]")).toBeNull();
    expect(typeof source.payload).toBe("string");
    expect(JSON.stringify(source)).toBe(text);
  });
  it("keeps hostile HTML inert even when it is inside decoded strings", async () => {
    const payload = {
      html: '<img src=x onerror="alert(1)"><script>alert(1)</script>',
    };
    await renderText({
      text: JSON.stringify({ payload: JSON.stringify(payload) }),
    });
    expect(container.querySelector("img, script")).toBeNull();
    expect(container.querySelector(".pretty-text")?.textContent).toBe(
      JSON.stringify({ payload }, null, 2)
    );
  });
  it("shows the full original source without a label on budget fallback", async () => {
    const source = {
      early: "{}",
      values: Array.from({ length: 101 }, () => "{broken"),
    };
    await renderText({ text: JSON.stringify(source) });
    expect(container.querySelector(".pretty-text")?.textContent).toBe(
      JSON.stringify(source)
    );
    expect(container.querySelector(".pretty-text__preview-label")).toBeNull();
  });
  it("does not repeat parsing on unrelated renders and scopes decoding to compact", async () => {
    const text = JSON.stringify({ payload: JSON.stringify({ score: 1 }) });
    const parse = vi.spyOn(JSON, "parse");
    await renderText({ text });
    const initialParses = parse.mock.calls.length;
    await act(async () =>
      root.render(
        <ThemeProvider themeMode="light">
          <PrettyText
            variant="compact"
            preCSS={css`
              margin: 0;
            `}
          >
            {text}
          </PrettyText>
        </ThemeProvider>
      )
    );
    expect(parse.mock.calls.length).toBe(initialParses);
    await renderText({ text, variant: "code" });
    expect(container.querySelector(".pretty-text__preview-label")).toBeNull();
    expect(container.querySelector(".cm-content")?.textContent).toContain(
      '\\"score\\"'
    );
    await renderText({ text });
    expect(
      container.querySelector(".pretty-text__preview-label")
    ).not.toBeNull();
  });
  it.each([
    "9007199254740993",
    "1e400",
    "1e-400",
    "0.123456789012345678901",
    "-0",
  ])("never rounds raw compact number %s, native or encoded", async (token) => {
    const inner = `{ "value": ${token} }`;
    for (const text of [` ${inner}\n`, JSON.stringify({ payload: inner })]) {
      await renderText({ text });
      expect(container.querySelector(".pretty-text")?.textContent).toBe(text);
      expect(
        container.querySelector(".pretty-text")?.classList.contains("font-mono")
      ).toBe(true);
      expect(container.querySelector(".pretty-text__preview-label")).toBeNull();
    }
  });
  it("memoizes by raw source, not the rounded output of the shared formatter", async () => {
    const first = '{"id":9007199254740993}';
    const second = ' {"id":9007199254740992.1}  ';
    await renderText({ text: first });
    expect(container.querySelector(".pretty-text")?.textContent).toBe(first);
    await renderText({ text: second });
    expect(container.querySelector(".pretty-text")?.textContent).toBe(second);
    await renderText({ text: '{"id":1e3}' });
    expect(container.querySelector(".pretty-text")?.textContent).toBe(
      '{\n  "id": 1000\n}'
    );
  });
  it("does not pass oversized compact source to the shared parser", async () => {
    const text = "9".repeat(100_001);
    const parse = vi.spyOn(JSON, "parse");
    await renderText({ text });
    expect(container.querySelector(".pretty-text")?.textContent).toBe(text);
    expect(parse).not.toHaveBeenCalled();
    expect(container.querySelector(".pretty-text__preview-label")).toBeNull();
  });
  it("leaves the default caller's existing number formatting policy unchanged", async () => {
    await renderText({ text: '{"id":9007199254740993}', variant: "code" });
    expect(container.querySelector(".cm-content")?.textContent).toContain(
      '"id": 9007199254740992'
    );
    expect(container.querySelector(".pretty-text__preview-label")).toBeNull();
  });
});
