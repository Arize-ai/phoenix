import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import {
  getSpanKindBadgeColor,
  SPAN_KIND_BADGE_COLORS,
  SpanKindBadge,
} from "../SpanKindBadge";

installTestMatchMedia();

const SPAN_KINDS = [
  "llm",
  "chain",
  "retriever",
  "reranker",
  "embedding",
  "agent",
  "tool",
  "guardrail",
  "evaluator",
  "decision",
  "prompt",
];

describe("span kind badge colors", () => {
  it("gives every span kind a color", () => {
    expect(Object.keys(SPAN_KIND_BADGE_COLORS).sort()).toEqual(
      [...SPAN_KINDS].sort()
    );
  });

  it("gives each colored kind a hue no other kind has", () => {
    const hues = Object.values(SPAN_KIND_BADGE_COLORS).filter(
      (color) => color !== "neutral"
    );
    expect(new Set(hues).size).toBe(hues.length);
  });

  it("never uses a success, warning or danger hue", () => {
    for (const color of Object.values(SPAN_KIND_BADGE_COLORS)) {
      expect(["green", "orange", "red", "celery"]).not.toContain(color);
    }
  });

  it("keeps llm purple, as in the Badge spec", () => {
    expect(getSpanKindBadgeColor("llm")).toBe("purple");
  });

  it("falls back to neutral for an unknown kind", () => {
    expect(getSpanKindBadgeColor("unknown")).toBe("neutral");
    expect(getSpanKindBadgeColor("something_else")).toBe("neutral");
  });
});

describe("SpanKindBadge", () => {
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

  it("renders the kind in its color with an icon that has no hue of its own", () => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="light">
          <SpanKindBadge spanKind="llm" />
        </ThemeProvider>
      );
    });
    const badge = container.querySelector(".badge");
    expect(badge?.getAttribute("data-color")).toBe("purple");
    expect(badge?.textContent).toBe("llm");
    const icon = badge?.querySelector(".badge__leading-visual > div");
    expect(icon).not.toBeNull();
    expect(
      (icon as HTMLElement).style.getPropertyValue("--span-kind-icon-color")
    ).toBe("");
  });
});
