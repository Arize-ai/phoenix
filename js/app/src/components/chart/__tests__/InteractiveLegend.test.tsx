import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DefaultLegendContentProps } from "recharts";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  InteractiveLegend,
  type InteractiveLegendProps,
  compactLegendProps,
  defaultLegendProps,
  useInteractiveLegend,
} from "@phoenix/components/chart";

const chartData = [
  {
    name: "A",
    pv: 2400,
    uv: 4000,
  },
  {
    name: "B",
    pv: 1398,
    uv: 3000,
  },
];

let container: HTMLDivElement;
let root: Root;

function findLegendButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) => element.getAttribute("aria-label") === label
  );
  expect(button).not.toBeNull();
  return button as HTMLButtonElement;
}

function TestChart({
  legendProps,
}: {
  legendProps?: Partial<
    Omit<InteractiveLegendProps, "hiddenDataKeys" | "onToggleDataKey">
  >;
}) {
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend();

  return (
    <>
      <span data-testid="uv-hidden">{String(isDataKeyHidden("uv"))}</span>
      <BarChart data={chartData} height={240} width={360}>
        <CartesianGrid />
        <XAxis dataKey="name" />
        <YAxis />
        <Bar dataKey="uv" fill="#8884d8" hide={isDataKeyHidden("uv")} />
        <Bar dataKey="pv" fill="#82ca9d" hide={isDataKeyHidden("pv")} />
        <InteractiveLegend
          {...defaultLegendProps}
          {...legendProps}
          hiddenDataKeys={hiddenDataKeys}
          iconSize={8}
          iconType="circle"
          onToggleDataKey={toggleDataKey}
        />
      </BarChart>
    </>
  );
}

function HookLegendContent({ payload }: DefaultLegendContentProps) {
  const [renderCount] = useState(1);

  return (
    <ul data-render-count={renderCount} data-testid="hook-legend">
      {payload?.map((entry, index) => (
        <li key={String(entry.dataKey ?? index)}>{entry.value}</li>
      ))}
    </ul>
  );
}

describe("InteractiveLegend", () => {
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

  it("toggles a chart item when its legend item is clicked", () => {
    act(() => {
      root.render(<TestChart />);
    });

    expect(
      container.querySelector('[data-testid="uv-hidden"]')?.textContent
    ).toBe("false");

    act(() => {
      findLegendButton("Hide uv").dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    const uvButton = findLegendButton("Show uv");
    expect(
      container.querySelector('[data-testid="uv-hidden"]')?.textContent
    ).toBe("true");
    expect(uvButton.getAttribute("aria-pressed")).toBe("false");
    expect(uvButton.getAttribute("data-inactive")).toBe("true");
  });

  it("keeps a horizontal legend to one overflow row instead of wrapping", () => {
    act(() => {
      root.render(<TestChart />);
    });

    const legend = container.querySelector(".recharts-default-legend");
    const row = legend?.querySelector(":scope > .overflow-row");
    expect(row).not.toBeNull();
    expect(row?.classList.contains("overflow-row--collapsed")).toBe(true);
    expect(row?.querySelectorAll(".recharts-legend-item")).toHaveLength(2);
    expect(legend?.querySelector("li")).toBeNull();
  });

  it("gives each horizontal legend item the wrapper's font size, so the overflow popover's copies match the row", () => {
    act(() => {
      root.render(<TestChart legendProps={compactLegendProps} />);
    });

    const items = container.querySelectorAll<HTMLElement>(
      ".recharts-legend-item"
    );
    expect(items).toHaveLength(2);
    items.forEach((item) => {
      expect(item.style.fontSize).toBe("var(--global-font-size-xs)");
    });
  });

  it("lists a vertical legend's items without an overflow row", () => {
    act(() => {
      root.render(
        <TestChart legendProps={{ layout: "vertical", align: "right" }} />
      );
    });

    const legend = container.querySelector(".recharts-default-legend");
    expect(legend?.tagName).toBe("UL");
    expect(legend?.querySelector(".overflow-row")).toBeNull();
    expect(legend?.querySelectorAll("li.recharts-legend-item")).toHaveLength(2);
  });

  it("does not toggle when the provided legend onClick prevents default", () => {
    const onClick = vi.fn<NonNullable<InteractiveLegendProps["onClick"]>>(
      (_entry, _index, event) => {
        event.preventDefault();
      }
    );

    act(() => {
      root.render(<TestChart legendProps={{ onClick }} />);
    });

    act(() => {
      findLegendButton("Hide uv").dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-testid="uv-hidden"]')?.textContent
    ).toBe("false");
    expect(findLegendButton("Hide uv").getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("renders custom Recharts legend content functions as React components", () => {
    act(() => {
      root.render(<TestChart legendProps={{ content: HookLegendContent }} />);
    });

    expect(
      container
        .querySelector('[data-testid="hook-legend"]')
        ?.getAttribute("data-render-count")
    ).toBe("1");

    act(() => {
      root.render(<TestChart />);
    });

    expect(container.querySelector('[data-testid="hook-legend"]')).toBeNull();
    expect(findLegendButton("Hide uv")).toBeTruthy();
  });
});
