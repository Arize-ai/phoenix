import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { MarkdownSourceBlock } from "../MarkdownSourceBlock";

describe("MarkdownSourceBlock", () => {
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

  it("displays raw Markdown with syntax-highlighted tokens", () => {
    act(() => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            systemTheme: "light",
            themeMode: "light",
            setThemeMode: () => undefined,
          }}
        >
          <MarkdownSourceBlock>
            {"# Heading\n\nA **strong** [link](https://example.com)."}
          </MarkdownSourceBlock>
        </ThemeContext.Provider>
      );
    });

    const sourceBlock = container.firstElementChild;
    const editor = container.querySelector(".cm-editor");
    const linkToken = Array.from(
      container.querySelectorAll<HTMLElement>(".cm-line span")
    ).find((token) => token.textContent?.includes("link"));

    expect(editor).not.toBeNull();
    expect(container.querySelector(".cm-content")?.textContent).toBe(
      "# HeadingA **strong** [link](https://example.com)."
    );
    expect(container.querySelectorAll(".cm-line span").length).toBeGreaterThan(
      0
    );
    expect(
      getComputedStyle(sourceBlock!).getPropertyValue(
        "--code-mirror-editor-background-color"
      )
    ).toBe("transparent");
    expect(linkToken).toBeDefined();
    expect(getComputedStyle(linkToken!).textDecoration).not.toContain(
      "underline"
    );
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
});
