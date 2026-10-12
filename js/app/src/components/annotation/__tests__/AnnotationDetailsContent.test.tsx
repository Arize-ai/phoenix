import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { AnnotationDetailsContent } from "../AnnotationDetailsContent";

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

async function renderExplanation(explanation: string | null | undefined) {
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light">
        <AnnotationDetailsContent
          annotation={{ name: "quality", explanation, label: "pass", score: 1 }}
        />
      </ThemeProvider>
    );
  });
}
describe("AnnotationDetailsContent explanations", () => {
  it.each([
    "A plain explanation\nwith a second line",
    '{"invalid":',
    '<img src=x onerror="alert(1)">',
  ])("preserves plain or malformed text safely: %s", async (explanation) => {
    await renderExplanation(explanation);
    expect(container.querySelector("pre")?.textContent).toBe(explanation);
    expect(container.querySelector("img")).toBeNull();
  });
  it.each([
    '{"reason":"relevant","details":[1,2]}',
    '[{"reason":"ok"}]',
    "null",
    '"a JSON string"',
  ])(
    "renders valid JSON with the production JSONBlock: %s",
    async (explanation) => {
      await renderExplanation(explanation);
      expect(container.querySelector(".cm-content")?.textContent).toContain(
        JSON.stringify(JSON.parse(explanation), null, 2).replaceAll("\n", "")
      );
      expect(
        container.querySelector(".cm-content")?.getAttribute("contenteditable")
      ).toBe("false");
    }
  );
  it.each(["", null, undefined])(
    "omits empty explanations: %s",
    async (explanation) => {
      await renderExplanation(explanation);
      expect(container.querySelector("pre, .cm-editor")).toBeNull();
    }
  );
  it("preserves the label and score", async () => {
    await renderExplanation('{"reason":"ok"}');
    expect(container.textContent).toContain("quality");
    expect(container.textContent).toContain("pass");
    expect(container.textContent).toContain("score");
  });
});
