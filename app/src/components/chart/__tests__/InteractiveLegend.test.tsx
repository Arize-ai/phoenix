import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DefaultLegendContentProps, LegendPayload } from "recharts";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  InteractiveLegend,
  type InteractiveLegendProps,
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
  if (!button) {
    throw new Error(`No legend button with aria-label "${label}"`);
  }
  return button;
}

function TestChart({
  defaultHiddenDataKeys,
  legendProps,
}: {
  defaultHiddenDataKeys?: string[];
  legendProps?: Partial<
    Omit<InteractiveLegendProps, "hiddenDataKeys" | "onToggleDataKey">
  >;
}) {
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey } =
    useInteractiveLegend({ defaultHiddenDataKeys });

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

function CustomLegendContent({ onClick, payload }: DefaultLegendContentProps) {
  return (
    <ul data-testid="custom-legend">
      {payload?.map((entry, index) => (
        <li key={String(entry.dataKey ?? index)}>
          <button
            data-inactive={String(entry.inactive === true)}
            onClick={(event) => {
              onClick?.(entry, index, event);
            }}
            type="button"
          >
            {entry.value}
          </button>
        </li>
      ))}
    </ul>
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

  it("renders legend items as toggle buttons", () => {
    act(() => {
      root.render(<TestChart />);
    });

    const uvButton = findLegendButton("Hide uv");
    expect(uvButton.type).toBe("button");
    expect(uvButton.getAttribute("aria-pressed")).toBe("true");
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

  it("supports initially hidden chart items", () => {
    act(() => {
      root.render(<TestChart defaultHiddenDataKeys={["pv"]} />);
    });

    expect(findLegendButton("Show pv").getAttribute("aria-pressed")).toBe(
      "false"
    );
  });

  it("renders supplemental entries without data keys as static items", () => {
    const additionalLegendItems: ReadonlyArray<LegendPayload> = [
      {
        value: "Baseline",
        type: "plainline",
        color: "#4338ca",
        payload: { strokeDasharray: "4 4" },
      },
    ];

    act(() => {
      root.render(<TestChart legendProps={{ additionalLegendItems }} />);
    });

    const baselineItem = Array.from(
      container.querySelectorAll(".recharts-legend-item")
    ).find((element) => element.textContent === "Baseline");
    expect(baselineItem).toBeTruthy();
    expect(baselineItem?.querySelector("button")).toBeNull();
    expect(
      baselineItem?.querySelector("line")?.getAttribute("stroke-dasharray")
    ).toBe("4 4");
  });

  it("calls the provided legend onClick before toggling", () => {
    const onClick = vi.fn<NonNullable<InteractiveLegendProps["onClick"]>>();

    act(() => {
      root.render(<TestChart legendProps={{ onClick }} />);
    });

    act(() => {
      findLegendButton("Hide uv").dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0].dataKey).toBe("uv");
    expect(
      container.querySelector('[data-testid="uv-hidden"]')?.textContent
    ).toBe("true");
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

  it("composes custom Recharts legend content with enhanced payload and click props", () => {
    act(() => {
      root.render(<TestChart legendProps={{ content: CustomLegendContent }} />);
    });

    const uvButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "uv"
    ) as HTMLButtonElement | undefined;
    expect(uvButton?.getAttribute("data-inactive")).toBe("false");

    act(() => {
      uvButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const hiddenUvButton = Array.from(
      container.querySelectorAll("button")
    ).find((button) => button.textContent === "uv");
    expect(
      container.querySelector('[data-testid="uv-hidden"]')?.textContent
    ).toBe("true");
    expect(hiddenUvButton?.getAttribute("data-inactive")).toBe("true");
  });

  it("clones custom Recharts legend content elements with enhanced props", () => {
    act(() => {
      root.render(
        <TestChart legendProps={{ content: <CustomLegendContent /> }} />
      );
    });

    const pvButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "pv"
    ) as HTMLButtonElement | undefined;
    expect(pvButton?.getAttribute("data-inactive")).toBe("false");

    act(() => {
      pvButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const hiddenPvButton = Array.from(
      container.querySelectorAll("button")
    ).find((button) => button.textContent === "pv");
    expect(hiddenPvButton?.getAttribute("data-inactive")).toBe("true");
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
