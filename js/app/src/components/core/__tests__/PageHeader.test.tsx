import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PageHeader } from "../PageHeader";

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

describe("PageHeader", () => {
  it("puts the labels on their own row beneath the subtitle", () => {
    act(() => {
      root.render(
        <PageHeader
          title="banking_saas_dataset"
          subTitle="banking_saas_dataset.jsonl"
          labels={<span>production</span>}
          extra={<button>Experiment</button>}
        />
      );
    });
    const labels = container.querySelector(
      '[data-testid="page-header-labels"]'
    );
    expect(labels?.textContent).toBe("production");
    const subtitle = Array.from(container.querySelectorAll("span")).find(
      (element) => element.textContent === "banking_saas_dataset.jsonl"
    );
    expect(
      subtitle!.compareDocumentPosition(labels!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(labels!.contains(container.querySelector("button"))).toBe(false);
  });

  it("leaves the labels row out when there are none", () => {
    act(() => {
      root.render(<PageHeader title="banking_saas_dataset" />);
    });
    expect(
      container.querySelector('[data-testid="page-header-labels"]')
    ).toBeNull();
  });
});
