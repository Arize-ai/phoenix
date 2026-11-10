import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { AnnotationNameAndValue } from "../AnnotationNameAndValue";

describe("AnnotationNameAndValue", () => {
  const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });
  afterEach(() => {
    while (mounted.length > 0) {
      const { root, container } = mounted.pop()!;
      act(() => root.unmount());
      container.remove();
    }
  });
  const render = (node: React.ReactNode) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    act(() =>
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          {node}
        </ThemeProvider>
      )
    );
    return container;
  };
  const annotation = {
    name: "addresses-request-span.is_rude",
    label: "false",
    score: 0.03,
  };

  it("shows the annotation's own name by default", () => {
    const container = render(
      <AnnotationNameAndValue
        annotation={annotation}
        displayPreference="score-and-label"
      />
    );
    expect(container.textContent).toContain("addresses-request-span.is_rude");
    expect(container.textContent).toContain("false");
  });

  it("shows the display name in place of the name, keeping the full name as the title", () => {
    const container = render(
      <AnnotationNameAndValue
        annotation={annotation}
        displayPreference="score-and-label"
        displayName="is_rude"
      />
    );
    expect(container.textContent).not.toContain("addresses-request-span");
    expect(container.textContent).toContain("is_rude");
    expect(
      container.querySelector('[title="addresses-request-span.is_rude"]')
    ).not.toBeNull();
  });

  it("shows only the value when the display name is null", () => {
    const container = render(
      <AnnotationNameAndValue
        annotation={annotation}
        displayPreference="score-and-label"
        displayName={null}
      />
    );
    expect(container.textContent).not.toContain("is_rude");
    expect(container.textContent).toContain("false");
    expect(container.textContent).toContain("0.03");
  });

  it("lets the name shrink and keeps the value's width when the name truncates first", () => {
    const container = render(
      <AnnotationNameAndValue
        annotation={annotation}
        displayPreference="score-and-label"
        minWidth={0}
        maxWidth="unset"
        truncateNameFirst
      />
    );
    const name = container.querySelector(
      '[title="addresses-request-span.is_rude"]'
    );
    const value = name?.nextElementSibling;
    expect(name && getComputedStyle(name).minWidth).toBe("0px");
    expect(name && getComputedStyle(name).flexShrink).toBe("1");
    expect(value && getComputedStyle(value).flexShrink).toBe("0");
  });
});
