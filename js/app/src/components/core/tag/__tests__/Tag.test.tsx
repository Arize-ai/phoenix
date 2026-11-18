import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { Tag } from "../Tag";

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

function render(element: ReactNode) {
  act(() => {
    root.render(
      <MemoryRouter>
        <ThemeProvider themeMode="light">{element}</ThemeProvider>
      </MemoryRouter>
    );
  });
  const tag = container.querySelector<HTMLElement>(".tag");
  if (tag === null) {
    throw new Error("no tag rendered");
  }
  return tag;
}

describe("Tag", () => {
  it("is a plain, unfocusable span when read-only", () => {
    const tag = render(<Tag>production</Tag>);
    expect(tag.tagName).toBe("SPAN");
    expect(container.querySelector("button, a, [tabindex]")).toBeNull();
    expect(tag.hasAttribute("data-interactive")).toBe(false);
  });

  it("is one button when operational", async () => {
    const onPress = vi.fn();
    const tag = render(<Tag onPress={onPress}>production</Tag>);
    expect(tag.tagName).toBe("BUTTON");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    await act(async () => userEvent.click(tag));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is a real link when it has an href", () => {
    const tag = render(<Tag href="/projects/abc/config">default</Tag>);
    expect(tag.tagName).toBe("A");
    expect(tag.getAttribute("href")).toBe("/projects/abc/config");
  });

  it("adds a remove button named after the tag when dismissible", async () => {
    const onRemove = vi.fn();
    render(<Tag onRemove={onRemove}>staging</Tag>);
    const remove = container.querySelector("button");
    expect(remove?.getAttribute("aria-label")).toBe("Remove staging");
    await act(async () => userEvent.click(remove!));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("names the remove button from textValue when the name is not text", () => {
    render(
      <Tag onRemove={() => {}} textValue="staging">
        <em>staging</em>
      </Tag>
    );
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Remove staging"
    );
  });

  it("makes the body and the remove button two stops when both are given", async () => {
    const onPress = vi.fn();
    const onRemove = vi.fn();
    render(
      <Tag onPress={onPress} onRemove={onRemove}>
        trace
      </Tag>
    );
    const [body, remove] = Array.from(container.querySelectorAll("button"));
    expect(body.classList.contains("tag__body")).toBe(true);
    await act(async () => userEvent.click(body));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onRemove).not.toHaveBeenCalled();
    await act(async () => userEvent.click(remove));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("passes a user's color through as stored, apart from the named palette", () => {
    const named = render(<Tag color="cyan">staging</Tag>);
    expect(named.getAttribute("data-color")).toBe("cyan");
    const user = render(<Tag userColor="#33c5e8">banking</Tag>);
    expect(user.getAttribute("data-color")).toBe("user");
    expect(user.style.getPropertyValue("--family-base-color")).toBe("#33c5e8");
  });
});
