import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";

import { useFilterSearchParam } from "../useFilterSearchParam";

const FILTER_PARAM = "evaluatorFilter";

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

/**
 * Renders the hook under a memory router and collects every setter identity
 * the hook returns, so tests can read the value, drive writes, and assert the
 * setter stays reference-stable across the URL changes those writes cause.
 */
function renderFilterParam({
  initialEntries,
  initialIndex,
}: {
  initialEntries: string[];
  initialIndex?: number;
}) {
  const setters: Array<(value: string) => void> = [];
  function TestFilterParam() {
    const [value, setValue] = useFilterSearchParam(FILTER_PARAM);
    setters.push(setValue);
    return <output>{value}</output>;
  }
  const router = createMemoryRouter(
    [{ path: "*", element: <TestFilterParam /> }],
    { initialEntries, initialIndex }
  );
  act(() => {
    root.render(<RouterProvider router={router} />);
  });
  const setFilterValue = (value: string) => {
    const setValue = setters.at(-1);
    if (!setValue) {
      throw new Error("the hook has not rendered");
    }
    act(() => {
      setValue(value);
    });
  };
  return { router, setters, setFilterValue };
}

describe("useFilterSearchParam", () => {
  it("seeds from the URL param and falls back to an empty string", () => {
    renderFilterParam({ initialEntries: ["/?evaluatorFilter=foo"] });
    expect(container.textContent).toBe("foo");

    act(() => {
      root.unmount();
    });
    root = createRoot(container);
    renderFilterParam({ initialEntries: ["/"] });
    expect(container.textContent).toBe("");
  });

  it("writes the trimmed value and preserves unrelated params", () => {
    const { router, setFilterValue } = renderFilterParam({
      initialEntries: ["/?other=1"],
    });

    setFilterValue("  foo  ");

    const params = new URLSearchParams(router.state.location.search);
    expect(params.get(FILTER_PARAM)).toBe("foo");
    expect(params.get("other")).toBe("1");
    expect(container.textContent).toBe("foo");
  });

  it("removes the param when the value is empty or whitespace", () => {
    const { router, setFilterValue } = renderFilterParam({
      initialEntries: ["/?evaluatorFilter=foo&other=1"],
    });

    setFilterValue("   ");

    const params = new URLSearchParams(router.state.location.search);
    expect(params.has(FILTER_PARAM)).toBe(false);
    expect(params.get("other")).toBe("1");
    expect(container.textContent).toBe("");
  });

  it("replaces the current history entry instead of pushing", () => {
    const { router, setFilterValue } = renderFilterParam({
      initialEntries: ["/start", "/list"],
      initialIndex: 1,
    });

    setFilterValue("foo");
    setFilterValue("bar");

    // Both writes replaced the /list entry, so one step back is /start; a
    // pushed write would have put an intermediate filter state there.
    act(() => {
      router.navigate(-1);
    });
    expect(router.state.location.pathname).toBe("/start");
  });

  it("keeps the setter reference-stable across its own URL writes", () => {
    const { setters, setFilterValue } = renderFilterParam({
      initialEntries: ["/"],
    });

    setFilterValue("foo");
    setFilterValue("bar");
    setFilterValue("");

    expect(setters.length).toBeGreaterThan(1);
    expect(new Set(setters).size).toBe(1);
  });
});
