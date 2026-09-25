import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { RetrievalMetricLabel } from "../RetrievalMetricLabel";

installTestMatchMedia();

describe("RetrievalMetricLabel", () => {
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

  const render = (element: ReactNode) => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          {element}
        </ThemeProvider>
      );
    });
  };

  it("renders a named score metric with the shared annotation treatment", () => {
    render(
      <RetrievalMetricLabel name="retrieval" metric="ndcg" k={5} score={0.75} />
    );

    expect(container.textContent).toContain("retrieval ndcg@5");
    expect(container.textContent).toContain("0.75");
  });

  it("renders a boolean hit metric as a label", () => {
    render(<RetrievalMetricLabel metric="hit" score={0} />);

    expect(container.textContent).toContain("hit");
    expect(container.textContent).toContain("false");
  });

  it("renders a missing numeric metric as an unavailable value", () => {
    render(<RetrievalMetricLabel metric="precision" score={null} />);

    expect(container.textContent).toContain("precision");
    expect(container.textContent).toContain("--");
  });
});
