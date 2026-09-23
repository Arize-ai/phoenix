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
  href,
  basename,
}: {
  href: string;
  basename?: string;
}) {
  act(() => {
    root.render(
      <MemoryRouter basename={basename} initialEntries={[basename ?? "/"]}>
        <MarkdownLink href={href} rel="noopener noreferrer" target="_blank">
          Link
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
});
