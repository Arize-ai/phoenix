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
    amt: 1500,
    0: 1000,
  },
  {
    name: "B",
    pv: 1398,
    uv: 3000,
    amt: 2000,
    0: 500,
  },
];

let container: HTMLDivElement;
let root: Root;

function findLegendButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (element) =>
      (element.getAttribute("aria-label") ?? element.textContent) === label
  );
  expect(button, `Expected legend button "${label}"`).toBeDefined();
  return button as HTMLButtonElement;
}

function TestChart({
  legendProps,
  dataKeys = ["uv", "pv", "amt"],
  defaultHiddenDataKeys,
  duplicateLabels = false,
}: {
  dataKeys?: (string | number)[];
  defaultHiddenDataKeys?: (string | number)[];
  duplicateLabels?: boolean;
  legendProps?: Partial<
    Omit<
      InteractiveLegendProps,
      "hiddenDataKeys" | "onToggleDataKey" | "onShowAll"
    >
  >;
}) {
  const { hiddenDataKeys, isDataKeyHidden, toggleDataKey, showAll } =
    useInteractiveLegend({ defaultHiddenDataKeys });

  return (
    <>
      <span data-testid="uv-hidden">{String(isDataKeyHidden("uv"))}</span>
      <BarChart data={chartData} height={240} width={360}>
        <CartesianGrid />
        <XAxis dataKey="name" />
        <YAxis />
        {dataKeys.map((dataKey) => (
          <Bar
            key={dataKey}
            className={`series-${dataKey}`}
            dataKey={dataKey}
            name={duplicateLabels ? "Same label" : undefined}
            fill="#8884d8"
            hide={isDataKeyHidden(dataKey)}
            isAnimationActive={false}
          />
        ))}
        <InteractiveLegend
          {...defaultLegendProps}
          {...legendProps}
          hiddenDataKeys={hiddenDataKeys}
          iconSize={8}
          iconType="circle"
          onToggleDataKey={toggleDataKey}
          onShowAll={showAll}
        />
      </BarChart>
    </>
  );
}

function clickLegend(label: string, shiftKey = false) {
  act(() => {
    findLegendButton(label).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey })
    );
  });
}

function expectVisibleSeries(
  visibleKeys: (string | number)[],
  allKeys = ["uv", "pv", "amt"] as (string | number)[]
) {
  for (const key of allKeys) {
    const visible = visibleKeys.includes(key);
    const button = findLegendButton(`${visible ? "Hide" : "Show"} ${key}`);
    expect(button.getAttribute("aria-pressed")).toBe(String(visible));
    expect(button.getAttribute("data-inactive")).toBe(visible ? null : "true");
    expect(
      container.querySelectorAll(`.series-${key} .recharts-rectangle`)
    ).toHaveLength(visible ? chartData.length : 0);
  }
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

function StatefulLegendContent({
  onClick,
  payload,
}: DefaultLegendContentProps) {
  const [count, setCount] = useState(1);

  return (
    <ul data-count={count} data-testid="stateful-legend">
      <li>
        <button onClick={() => setCount((value) => value + 1)} type="button">
          Count: {count}
        </button>
      </li>
      {payload?.map((entry, index) => (
        <li key={String(entry.dataKey ?? index)}>
          <button
            data-inactive={String(entry.inactive === true)}
            onClick={(event) => onClick?.(entry, index, event)}
            type="button"
          >
            {entry.value}
          </button>
        </li>
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

    clickLegend("Hide uv");

    const uvButton = findLegendButton("Show uv");
    expect(
      container.querySelector('[data-testid="uv-hidden"]')?.textContent
    ).toBe("true");
    expect(uvButton.getAttribute("aria-pressed")).toBe("false");
    expect(uvButton.getAttribute("data-inactive")).toBe("true");
  });

  it("isolates on every shift-click and restores all with Show all", () => {
    act(() => root.render(<TestChart />));
    expectVisibleSeries(["uv", "pv", "amt"]);
    clickLegend("Hide uv", true);
    expectVisibleSeries(["uv"]);
    clickLegend("Show pv", true);
    expectVisibleSeries(["pv"]);
    clickLegend("Hide pv", true);
    expectVisibleSeries(["pv"]);
    clickLegend("Show all");
    expectVisibleSeries(["uv", "pv", "amt"]);
    clickLegend("Hide uv");
    expectVisibleSeries(["pv", "amt"]);
  });

  it("shows a reset after ordinary toggles and removes it when all series are visible", () => {
    act(() => root.render(<TestChart />));
    const resetButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (button) => button.textContent === "Show all"
      );
    expect(resetButtons()).toHaveLength(0);
    clickLegend("Hide uv");
    expect(resetButtons()).toHaveLength(1);
    expect(findLegendButton("Show all").type).toBe("button");
    expect(findLegendButton("Show all").disabled).toBe(false);
    clickLegend("Show all");
    expectVisibleSeries(["uv", "pv", "amt"]);
    expect(resetButtons()).toHaveLength(0);
    clickLegend("Hide uv");
    clickLegend("Hide pv");
    clickLegend("Hide amt");
    expectVisibleSeries([]);
    clickLegend("Show all");
    expectVisibleSeries(["uv", "pv", "amt"]);
    expect(resetButtons()).toHaveLength(0);
    clickLegend("Hide uv");
    clickLegend("Show uv");
    expect(resetButtons()).toHaveLength(0);
  });

  it("shows the reset only for hidden series in the current payload", () => {
    const hasShowAll = () =>
      Array.from(container.querySelectorAll("button")).some(
        (button) => button.textContent === "Show all"
      );
    act(() =>
      root.render(
        <TestChart dataKeys={["uv", "pv"]} defaultHiddenDataKeys={["amt"]} />
      )
    );
    expect(hasShowAll()).toBe(false);
    act(() => root.render(<TestChart />));
    expectVisibleSeries(["uv", "pv"]);
    expect(hasShowAll()).toBe(true);
    act(() => root.render(<TestChart dataKeys={["uv", "pv"]} />));
    clickLegend("Hide uv");
    clickLegend("Show all");
    act(() => root.render(<TestChart />));
    expectVisibleSeries(["uv", "pv", "amt"]);
  });

  it("does not hide static or non-interactive entries when isolating a single series", () => {
    act(() =>
      root.render(
        <TestChart
          dataKeys={["uv"]}
          legendProps={{
            additionalLegendItems: [
              { value: "Baseline", type: "plainline" },
              { value: "Function", type: "line", dataKey: () => 1 },
              { value: "Omitted", type: "none", dataKey: "omitted" },
            ],
          }}
        />
      )
    );
    clickLegend("Hide uv", true);
    expectVisibleSeries(["uv"], ["uv"]);
    // A spurious hidden key would make the reset button appear.
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it.each([["amt"], ["uv", "pv", "amt"]])(
    "isolates from partially or fully hidden series (%j)",
    (...hiddenKeys) => {
      act(() => root.render(<TestChart defaultHiddenDataKeys={hiddenKeys} />));
      clickLegend(`${hiddenKeys.includes("uv") ? "Show" : "Hide"} uv`, true);
      expectVisibleSeries(["uv"]);
      clickLegend("Hide uv", true);
      expectVisibleSeries(["uv"]);
      clickLegend("Show all");
      expectVisibleSeries(["uv", "pv", "amt"]);
    }
  );

  it("keeps shift-click as isolation after ordinary clicks", () => {
    act(() => root.render(<TestChart />));
    clickLegend("Hide pv");
    clickLegend("Hide amt");
    expectVisibleSeries(["uv"]);
    clickLegend("Hide uv", true);
    expectVisibleSeries(["uv"]);
    clickLegend("Show pv", true);
    clickLegend("Show uv");
    expectVisibleSeries(["uv", "pv"]);
    clickLegend("Hide pv", true);
    expectVisibleSeries(["pv"]);
  });

  it("keeps a single series visible on repeated shift-click", () => {
    act(() =>
      root.render(
        <TestChart dataKeys={["uv"]} defaultHiddenDataKeys={["uv"]} />
      )
    );
    clickLegend("Show uv", true);
    expectVisibleSeries(["uv"], ["uv"]);
    clickLegend("Hide uv", true);
    expectVisibleSeries(["uv"], ["uv"]);
  });

  it("isolates current keys and includes newly appearing series in the next selection", () => {
    act(() =>
      root.render(
        <TestChart dataKeys={["uv", "pv"]} defaultHiddenDataKeys={["amt"]} />
      )
    );
    clickLegend("Hide uv", true);
    act(() => root.render(<TestChart />));
    expectVisibleSeries(["uv", "amt"]);
    clickLegend("Hide uv", true);
    act(() => root.render(<TestChart dataKeys={["uv", "pv", "amt", 0]} />));
    expectVisibleSeries(["uv", 0], ["uv", "pv", "amt", 0]);
    clickLegend("Hide 0", true);
    expectVisibleSeries([0], ["uv", "pv", "amt", 0]);
    clickLegend("Show all");
    expectVisibleSeries(["uv", "pv", "amt", 0], ["uv", "pv", "amt", 0]);
  });

  it("isolates by data key when labels are identical", () => {
    act(() =>
      root.render(
        <TestChart duplicateLabels legendProps={{ itemSorter: null }} />
      )
    );
    // Preserve chart order so the first identically labeled button targets uv.
    expect(container.querySelectorAll("button")).toHaveLength(3);
    clickLegend("Hide Same label", true);
    expect(
      container.querySelectorAll(".series-uv .recharts-rectangle")
    ).toHaveLength(chartData.length);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(
      chartData.length
    );
    expect(
      container.querySelectorAll('button[aria-pressed="true"]')
    ).toHaveLength(1);
    clickLegend("Show all");
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(
      chartData.length * 3
    );
  });

  it("excludes static, function and type-none entries from isolation", () => {
    act(() =>
      root.render(
        <TestChart
          legendProps={{
            additionalLegendItems: [
              { value: "Baseline", type: "plainline" },
              { value: "Function", type: "line", dataKey: () => 1 },
              { value: "Omitted", type: "none", dataKey: "omitted" },
              { value: "UV duplicate", type: "rect", dataKey: "uv" },
            ],
          }}
        />
      )
    );
    expect(container.querySelectorAll("button")).toHaveLength(4);
    clickLegend("Hide uv", true);
    expectVisibleSeries(["uv"]);
    clickLegend("Show all");
    expectVisibleSeries(["uv", "pv", "amt"]);
  });

  it("ignores non-interactive entries forwarded by custom content on shift-click", () => {
    act(() =>
      root.render(
        <TestChart
          legendProps={{
            content: CustomLegendContent,
            additionalLegendItems: [
              { value: "Baseline", type: "plainline" },
              { value: "Function", type: "line", dataKey: () => 1 },
              { value: "Omitted", type: "none", dataKey: "omitted" },
            ],
          }}
        />
      )
    );
    for (const label of ["Baseline", "Function", "Omitted"]) {
      clickLegend(label, true);
      expect(
        container.querySelectorAll(".recharts-bar-rectangle")
      ).toHaveLength(chartData.length * 3);
      expect(
        container.querySelectorAll('button[data-inactive="true"]')
      ).toHaveLength(0);
    }
  });

  it("allows onClick to prevent shift-click isolation", () => {
    act(() =>
      root.render(
        <TestChart
          legendProps={{
            onClick: (_entry, _index, event) => event.preventDefault(),
          }}
        />
      )
    );
    clickLegend("Hide uv", true);
    expectVisibleSeries(["uv", "pv", "amt"]);
  });

  it.each([
    { name: "function", content: CustomLegendContent },
    { name: "element", content: <CustomLegendContent /> },
  ])("supports shift-click through custom $name content", ({ content }) => {
    act(() => root.render(<TestChart legendProps={{ content }} />));
    clickLegend("uv", true);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(
      chartData.length
    );
    expect(
      container.querySelectorAll('button[data-inactive="true"]')
    ).toHaveLength(2);
    clickLegend("uv", true);
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(
      chartData.length
    );
    clickLegend("Show all");
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(
      chartData.length * 3
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

    clickLegend("Hide uv");

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0].dataKey).toBe("uv");
    expect(
      container.querySelector('[data-testid="uv-hidden"]')?.textContent
    ).toBe("true");

    clickLegend("Show all");

    expect(onClick).toHaveBeenCalledTimes(1);
    expectVisibleSeries(["uv", "pv", "amt"]);
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

    clickLegend("Hide uv");

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

    const uvButton = findLegendButton("uv");
    expect(uvButton.getAttribute("data-inactive")).toBe("false");

    clickLegend("uv");

    const hiddenUvButton = findLegendButton("uv");
    expect(
      container.querySelector('[data-testid="uv-hidden"]')?.textContent
    ).toBe("true");
    expect(hiddenUvButton.getAttribute("data-inactive")).toBe("true");
  });

  it("clones custom Recharts legend content elements with enhanced props", () => {
    act(() => {
      root.render(
        <TestChart legendProps={{ content: <CustomLegendContent /> }} />
      );
    });

    const pvButton = findLegendButton("pv");
    expect(pvButton.getAttribute("data-inactive")).toBe("false");

    clickLegend("pv");

    const hiddenPvButton = findLegendButton("pv");
    expect(hiddenPvButton.getAttribute("data-inactive")).toBe("true");
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

  it.each([
    { kind: "function", content: StatefulLegendContent },
    { kind: "element", content: <StatefulLegendContent /> },
  ])(
    "preserves custom $kind content state when Show all appears and disappears",
    ({ content }) => {
      act(() => root.render(<TestChart legendProps={{ content }} />));
      const count = () =>
        container
          .querySelector('[data-testid="stateful-legend"]')
          ?.getAttribute("data-count");
      const resetButtons = () =>
        Array.from(container.querySelectorAll("button")).filter(
          (button) => button.textContent === "Show all"
        );

      expect(resetButtons()).toHaveLength(0);
      clickLegend("Count: 1");
      expect(count()).toBe("2");

      clickLegend("uv");
      expect(resetButtons()).toHaveLength(1);
      expect(count()).toBe("2");
      expect(
        container.querySelectorAll(".series-uv .recharts-rectangle")
      ).toHaveLength(0);

      clickLegend("Show all");
      expect(resetButtons()).toHaveLength(0);
      expect(count()).toBe("2");
      for (const key of ["uv", "pv", "amt"]) {
        expect(findLegendButton(key).getAttribute("data-inactive")).toBe(
          "false"
        );
        expect(
          container.querySelectorAll(`.series-${key} .recharts-rectangle`)
        ).toHaveLength(chartData.length);
      }
    }
  );
});
