import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
    '{"encoded":"{\\"nested\\":true}"}',
  ])(
    "preserves all JSON values rather than collapsing data: %s",
    async (text) => {
      await renderText({ text });
      expect(container.querySelector(".pretty-text")?.textContent).toBe(
        JSON.stringify(JSON.parse(text), null, 2)
      );
      expect(
        container.querySelector(".pretty-text")?.classList.contains("font-mono")
      ).toBe(true);
      expect(
        container.querySelector(".cm-editor, [contenteditable], [title]")
      ).toBeNull();
    }
  );
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
});
