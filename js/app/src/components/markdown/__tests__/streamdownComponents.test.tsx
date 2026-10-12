import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";

import { MarkdownBlock } from "../MarkdownBlock";
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

describe("MarkdownBlock", () => {
  it("defers syntax highlighting until a streamed code fence closes", async () => {
    await act(async () => {
      root.render(
        <MarkdownBlock
          mode="markdown"
          renderMode="streaming"
          isAnimating
          margin="none"
        >
          {'```ts\nconst greeting = "hello";'}
        </MarkdownBlock>
      );
    });

    const incompleteCodeBlock = container.querySelector(
      '[data-streamdown="code-block"]'
    );
    expect(incompleteCodeBlock?.getAttribute("data-incomplete")).toBe("true");
    expect(
      incompleteCodeBlock?.querySelector(
        '[data-streamdown="code-block-actions"]'
      )
    ).toBeNull();
    expect(incompleteCodeBlock?.textContent).toContain(
      'const greeting = "hello";'
    );

    await act(async () => {
      root.render(
        <MarkdownBlock
          mode="markdown"
          renderMode="streaming"
          isAnimating
          margin="none"
        >
          {'```ts\nconst greeting = "hello";\n```'}
        </MarkdownBlock>
      );
    });

    const completedCodeBlock = container.querySelector(
      '[data-streamdown="code-block"]'
    );
    expect(completedCodeBlock?.hasAttribute("data-incomplete")).toBe(false);
    expect(
      completedCodeBlock?.querySelectorAll(
        '[data-streamdown="code-block-actions"] button'
      )
    ).toHaveLength(2);
  });

  it("keeps streamed code blocks in the transcript scroll flow", async () => {
    await act(async () => {
      root.render(
        <MarkdownBlock
          mode="markdown"
          renderMode="streaming"
          isAnimating
          margin="none"
        >
          {'```ts\nconst greeting = "hello";\n```'}
        </MarkdownBlock>
      );
    });

    const codeBlockBody = container.querySelector<HTMLElement>(
      '[data-streamdown="code-block-body"]'
    );
    expect(codeBlockBody).not.toBeNull();
    expect(codeBlockBody?.style.maxHeight).toBe("");
    expect(codeBlockBody?.className).not.toContain("overflow-y-auto");
  });

  it("adds animation wrappers only while streaming is active", () => {
    act(() => {
      root.render(
        <MarkdownBlock
          mode="markdown"
          renderMode="streaming"
          isAnimating
          margin="none"
        >
          Hello streaming world
        </MarkdownBlock>
      );
    });

    expect(container.querySelector("[data-sd-animate]")).not.toBeNull();

    act(() => {
      root.render(
        <MarkdownBlock mode="markdown" renderMode="streaming" margin="none">
          Hello streaming world
        </MarkdownBlock>
      );
    });

    expect(container.querySelector("[data-sd-animate]")).toBeNull();
  });
});
