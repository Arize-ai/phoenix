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
  it("shows the full formatted source without a label on budget fallback", async () => {
    const source = {
      early: "{}",
      values: Array.from({ length: 101 }, () => "{broken"),
    };
    await renderText({ text: JSON.stringify(source) });
    expect(container.querySelector(".pretty-text")?.textContent).toBe(
      JSON.stringify(source, null, 2)
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
});
