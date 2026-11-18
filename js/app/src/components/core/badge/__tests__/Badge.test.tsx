import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { Badge, type BadgeProps } from "../Badge";

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

function render(props: BadgeProps) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light">
        <Badge {...props} />
      </ThemeProvider>
    );
  });
  const badge = container.querySelector(".badge");
  if (badge === null) {
    throw new Error("no badge rendered");
  }
  return badge;
}

describe("Badge", () => {
  it("is a neutral M nominal badge by default", () => {
    const badge = render({ children: "system" });
    expect(badge.getAttribute("data-color")).toBe("neutral");
    expect(badge.hasAttribute("data-variant")).toBe(false);
    expect(badge.getAttribute("data-size")).toBe("M");
  });

  it("takes its color from a variant instead of a hue", () => {
    const badge = render({ children: "Beta", variant: "info", size: "S" });
    expect(badge.getAttribute("data-variant")).toBe("info");
    expect(badge.hasAttribute("data-color")).toBe(false);
    expect(badge.getAttribute("data-size")).toBe("S");
  });

  it("is never focusable or a hit target", () => {
    const badge = render({ children: "LLM", color: "purple" });
    expect(badge.tagName).toBe("SPAN");
    expect(badge.hasAttribute("tabindex")).toBe(false);
    expect(badge.hasAttribute("role")).toBe(false);
    expect(container.querySelector("button, a, [tabindex]")).toBeNull();
  });

  it("hides its leading visual from assistive technology", () => {
    const badge = render({
      children: "chain",
      leadingVisual: <svg data-testid="icon" />,
    });
    const visual = badge.querySelector(".badge__leading-visual");
    expect(visual?.getAttribute("aria-hidden")).toBe("true");
    expect(badge.textContent).toBe("chain");
  });
});
