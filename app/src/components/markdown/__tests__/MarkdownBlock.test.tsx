import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { Streamdown } from "streamdown";

import { streamdownComponents } from "../streamdownComponents";

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

function renderMarkdown(markdown: string) {
  act(() => {
    root.render(
      <MemoryRouter>
        <Streamdown components={streamdownComponents}>{markdown}</Streamdown>
      </MemoryRouter>
    );
  });
}

describe("markdown link parsing", () => {
  it("preserves multiple query parameters and fragments from markdown source", () => {
    renderMarkdown("[label](/path?a=1&b=2#frag)");

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/path?a=1&b=2#frag");
    expect(link?.textContent).toBe("label");
  });

  it("preserves encoded query values from markdown source", () => {
    renderMarkdown(
      "[filtered traces](/projects/1/traces?filterCondition=span_kind%20%3D%3D%20%27LLM%27)"
    );

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      "/projects/1/traces?filterCondition=span_kind%20%3D%3D%20%27LLM%27"
    );
  });

  it("keeps the destination when surrounding punctuation follows the link", () => {
    renderMarkdown("see [x](/path?a=1).");

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/path?a=1");
    expect(container.textContent).toContain(".");
  });

  it("keeps the destination when a comma or closing parenthesis follows the link", () => {
    renderMarkdown("see [x](/path?a=1), and ([y](/path?b=2))");

    const hrefs = Array.from(container.querySelectorAll("a")).map((anchor) =>
      anchor.getAttribute("href")
    );
    expect(hrefs).toEqual(["/path?a=1", "/path?b=2"]);
  });

  it("does not use display text as the destination", () => {
    renderMarkdown("[other](/real?a=1)");

    const link = container.querySelector("a");
    expect(link?.textContent).toBe("other");
    expect(link?.getAttribute("href")).toBe("/real?a=1");
  });
});
