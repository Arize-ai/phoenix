import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";

import { MarkdownLink } from "../streamdownComponents";

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

function renderMarkdownLink({
  children = "Link",
  href,
  basename,
}: {
  children?: string;
  href: string;
  basename?: string;
}) {
  act(() => {
    root.render(
      <MemoryRouter basename={basename} initialEntries={[basename ?? "/"]}>
        <MarkdownLink href={href} rel="noopener noreferrer" target="_blank">
          {children}
        </MarkdownLink>
      </MemoryRouter>
    );
  });
}

describe("MarkdownLink", () => {
  it("delegates app link href generation to React Router", () => {
    renderMarkdownLink({ href: "/settings/general", basename: "/phoenix" });

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/phoenix/settings/general");
  });

  it("preserves query strings on internal links when a basename is set", () => {
    renderMarkdownLink({ href: "/settings?tab=ai", basename: "/phoenix" });

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/phoenix/settings?tab=ai");
    expect(link?.getAttribute("target")).toBeNull();
    expect(link?.getAttribute("rel")).toBeNull();
  });

  it("does not pass Streamdown's target attributes into React Router links", () => {
    renderMarkdownLink({ href: "/settings/general" });

    const link = container.querySelector("a");
    expect(link?.getAttribute("target")).toBeNull();
    expect(link?.getAttribute("rel")).toBeNull();
  });

  it("keeps Streamdown's target attributes for external links", () => {
    renderMarkdownLink({ href: "https://arize.com/docs/phoenix" });

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://arize.com/docs/phoenix");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("preserves query strings and fragments on external links", () => {
    renderMarkdownLink({
      href: "https://arize.com/docs/phoenix/x?a=1&b=2#y",
    });

    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      "https://arize.com/docs/phoenix/x?a=1&b=2#y"
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does not use display text as the destination", () => {
    renderMarkdownLink({ children: "other", href: "/real?a=1" });

    const link = container.querySelector("a");
    expect(link?.textContent).toBe("other");
    expect(link?.getAttribute("href")).toBe("/real?a=1");
  });
});
