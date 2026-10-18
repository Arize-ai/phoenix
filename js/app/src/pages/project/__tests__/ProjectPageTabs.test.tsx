import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectTabs } from "../ProjectTabs";

function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{`${pathname}${search}${hash}`}</output>
      <button data-testid="back" onClick={() => navigate(-1)} />
    </>
  );
}

// The time range and filter survive a tab switch; the selected span does not
// (clearSelectionScopedParams), and the hash is kept.
const INITIAL_ENTRY =
  "/projects/UHJvamVjdDox/traces?timeRangeKey=7d&spanFilterCondition=x&selectedSpanNodeId=abc#top";
const PRESERVED = "?timeRangeKey=7d&spanFilterCondition=x#top";

const cases = [
  { label: "Spans", tab: "spans" },
  { label: "Traces", tab: "traces" },
  { label: "Sessions", tab: "sessions" },
  { label: "Metrics", tab: "metrics" },
  { label: "Config", tab: "config" },
] as const;
const otherTabs = cases.filter(({ tab }) => tab !== "traces");

describe("project page tabs", () => {
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

  function render({ basename }: { basename?: string } = {}) {
    act(() => {
      root.render(
        <MemoryRouter
          basename={basename}
          initialEntries={[`${basename ?? ""}${INITIAL_ENTRY}`]}
        >
          <Routes>
            <Route
              path="/projects/:projectId/*"
              element={
                <>
                  <ProjectTabs />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      );
    });
  }

  const getTab = (label: string) => {
    const tab = Array.from(
      container.querySelectorAll<HTMLElement>('[role="tab"]')
    ).find((el) => el.textContent === label);
    if (!tab) throw new Error(`tab ${label} not rendered`);
    return tab;
  };
  const currentLocation = () =>
    container.querySelector('[data-testid="location"]')?.textContent;

  it.each(otherTabs)(
    "$label tab is a link to its URL so mod/middle-click can open it in a new tab",
    ({ label, tab }) => {
      render();
      const el = getTab(label);
      expect(el.tagName).toBe("A");
      expect(el.getAttribute("href")).toBe(
        `/projects/UHJvamVjdDox/${tab}${PRESERVED}`
      );
    }
  );

  it("clicking the selected tab does nothing: it stays put and keeps the selected span", () => {
    render();
    const traces = getTab("Traces");
    expect(traces.tagName).toBe("DIV");
    act(() => traces.click());
    expect(currentLocation()).toBe(INITIAL_ENTRY);
  });

  it("tab links keep the app's basename when Phoenix is served under a path prefix", () => {
    render({ basename: "/phoenix" });
    expect(getTab("Spans").getAttribute("href")).toBe(
      `/phoenix/projects/UHJvamVjdDox/spans${PRESERVED}`
    );
  });

  it.each(otherTabs)(
    "plain click on $label navigates in place, keeping time range and filters",
    ({ label, tab }) => {
      render();
      act(() => getTab(label).click());
      expect(currentLocation()).toBe(
        `/projects/UHJvamVjdDox/${tab}${PRESERVED}`
      );
    }
  );

  it("a plain click adds one history entry, so Back returns to the previous tab", () => {
    render();
    act(() => getTab("Spans").click());
    act(() =>
      container.querySelector<HTMLElement>('[data-testid="back"]')!.click()
    );
    expect(currentLocation()).toBe(INITIAL_ENTRY);
  });

  it.each(
    otherTabs.flatMap((c) => [
      { ...c, modifier: "metaKey" as const },
      { ...c, modifier: "ctrlKey" as const },
    ])
  )(
    "$modifier-click on $label leaves the current page to the browser (no in-app navigation)",
    ({ label, modifier }) => {
      render();
      act(() => {
        getTab(label).dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            [modifier]: true,
          })
        );
      });
      expect(currentLocation()).toBe(INITIAL_ENTRY);
    }
  );

  it("arrow-key selection still switches tabs", () => {
    render();
    const traces = getTab("Traces");
    act(() => traces.focus());
    act(() => {
      traces.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });
    expect(currentLocation()).toBe(
      `/projects/UHJvamVjdDox/sessions${PRESERVED}`
    );
  });
});
