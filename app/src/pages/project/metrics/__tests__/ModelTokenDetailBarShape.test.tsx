import { act } from "react";
import { createRoot } from "react-dom/client";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { describe, expect, it } from "vitest";

import { ModelTokenDetailBarShape } from "../ModelTokenDetailBarShape";
import type { ModelTokenDetailChartDatum } from "../tokenDetails";

const SERIES = [
  { dataKey: "input", isPrompt: true, tokenType: "input" },
  { dataKey: "cacheRead", isPrompt: true, tokenType: "cache_read" },
  { dataKey: "output", isPrompt: false, tokenType: "output" },
];

/**
 * Renders one row and returns each series' bar path, in stacking order. Rows
 * omit the series they have no value for, so the result is shorter than
 * `SERIES` whenever the row does not draw every series.
 */
async function renderBarPaths(datum: ModelTokenDetailChartDatum) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(
      <BarChart
        width={400}
        height={100}
        data={[datum]}
        layout="vertical"
        barSize={10}
      >
        <XAxis type="number" />
        <YAxis type="category" dataKey="model" />
        {SERIES.map((series) => (
          <Bar
            dataKey={series.dataKey}
            isAnimationActive={false}
            key={series.dataKey}
            shape={
              <ModelTokenDetailBarShape
                allSeries={SERIES}
                isDataKeyHidden={() => false}
                series={series}
              />
            }
            stackId="a"
          />
        ))}
      </BarChart>
    );
  });
  return [...container.querySelectorAll("path")]
    .map((path) => path.getAttribute("d") ?? "")
    .filter((d) => d.startsWith("M"));
}

/** Rounded corners are drawn as arcs; square ones are straight lines. */
const isRounded = (path: string) => path.includes("A");

describe("ModelTokenDetailBarShape", () => {
  it("rounds the segment that ends a row even when later series exist", async () => {
    // This row has no completion usage, so the stack ends at cache read
    // rather than at the last series in the chart.
    const [start, end, ...rest] = await renderBarPaths({
      model: "gpt",
      total: 3,
      input: 1,
      cacheRead: 2,
    });

    expect(rest).toEqual([]);
    expect(isRounded(start)).toBe(true);
    expect(isRounded(end)).toBe(true);
  });

  it("leaves a segment in the middle of a row square", async () => {
    const [, middle] = await renderBarPaths({
      model: "gpt",
      total: 6,
      input: 1,
      cacheRead: 2,
      output: 3,
    });

    expect(isRounded(middle)).toBe(false);
  });
});
