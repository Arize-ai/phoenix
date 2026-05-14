import { describe, expect, it } from "vitest";

import { renderGeneratedUISpecSchema } from "@phoenix/components/agent/generativeUICatalog";

function buildSpec(element: Record<string, unknown>) {
  return {
    root: "chart",
    elements: {
      chart: {
        ...element,
        children: [],
      },
    },
  };
}

describe("renderGeneratedUISpecSchema", () => {
  it("accepts chart specs at the configured bounds", () => {
    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "BarChart",
          props: {
            title: "Bar",
            data: Array.from({ length: 12 }, (_, index) => ({
              label: `Item ${index + 1}`,
              value: index + 1,
            })),
          },
        })
      ).success
    ).toBe(true);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "VerticalBarChart",
          props: {
            title: "Vertical",
            data: Array.from({ length: 2 }, (_, index) => ({
              label: `Bucket ${index + 1}`,
              value: index + 1,
              highlight: index === 0 ? index + 2 : null,
            })),
            baseLabel: "Baseline",
            highlightLabel: "Highlighted",
          },
        })
      ).success
    ).toBe(true);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "StackedBarChart",
          props: {
            title: "Stacked",
            data: Array.from({ length: 12 }, (_, barIndex) => ({
              label: `Row ${barIndex + 1}`,
              segments: Array.from({ length: 4 }, (_, segmentIndex) => ({
                label: `Segment ${segmentIndex + 1}`,
                value: segmentIndex + 1,
              })),
            })),
          },
        })
      ).success
    ).toBe(true);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "LineChart",
          props: {
            title: "Line",
            lines: Array.from({ length: 4 }, (_, index) => ({
              label: `Series ${index + 1}`,
              data: [index, index + 1],
            })),
          },
        })
      ).success
    ).toBe(true);
  });

  it("rejects bar charts outside the supported item count", () => {
    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "BarChart",
          props: {
            title: "Too few",
            data: [{ label: "Only item", value: 1 }],
          },
        })
      ).success
    ).toBe(false);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "BarChart",
          props: {
            title: "Too many",
            data: Array.from({ length: 13 }, (_, index) => ({
              label: `Item ${index + 1}`,
              value: index + 1,
            })),
          },
        })
      ).success
    ).toBe(false);
  });

  it("rejects vertical bar charts outside the supported item count", () => {
    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "VerticalBarChart",
          props: {
            title: "Too few",
            data: [{ label: "Only item", value: 1 }],
          },
        })
      ).success
    ).toBe(false);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "VerticalBarChart",
          props: {
            title: "Too many",
            data: Array.from({ length: 13 }, (_, index) => ({
              label: `Bucket ${index + 1}`,
              value: index + 1,
            })),
          },
        })
      ).success
    ).toBe(false);
  });

  it("rejects horizontal stacked bar charts outside the supported row and segment counts", () => {
    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "StackedBarChart",
          props: {
            title: "Too few rows",
            data: [
              {
                label: "Only row",
                segments: [
                  { label: "A", value: 1 },
                  { label: "B", value: 2 },
                ],
              },
            ],
          },
        })
      ).success
    ).toBe(false);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "StackedBarChart",
          props: {
            title: "Too many rows",
            data: Array.from({ length: 13 }, (_, barIndex) => ({
              label: `Row ${barIndex + 1}`,
              segments: [
                { label: "A", value: 1 },
                { label: "B", value: 2 },
              ],
            })),
          },
        })
      ).success
    ).toBe(false);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "StackedBarChart",
          props: {
            title: "Too few segments",
            data: [
              {
                label: "Row 1",
                segments: [{ label: "A", value: 1 }],
              },
              {
                label: "Row 2",
                segments: [
                  { label: "A", value: 1 },
                  { label: "B", value: 2 },
                ],
              },
            ],
          },
        })
      ).success
    ).toBe(false);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "StackedBarChart",
          props: {
            title: "Too many segments",
            data: [
              {
                label: "Row 1",
                segments: Array.from({ length: 5 }, (_, index) => ({
                  label: `Segment ${index + 1}`,
                  value: index + 1,
                })),
              },
              {
                label: "Row 2",
                segments: [
                  { label: "A", value: 1 },
                  { label: "B", value: 2 },
                ],
              },
            ],
          },
        })
      ).success
    ).toBe(false);
  });

  it("rejects line charts outside the supported series count", () => {
    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "LineChart",
          props: {
            title: "Too few",
            lines: [],
          },
        })
      ).success
    ).toBe(false);

    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "LineChart",
          props: {
            title: "Too many",
            lines: Array.from({ length: 5 }, (_, index) => ({
              label: `Series ${index + 1}`,
              data: [index, index + 1],
            })),
          },
        })
      ).success
    ).toBe(false);
  });

  it("rejects the removed vertical stacked bar chart type", () => {
    expect(
      renderGeneratedUISpecSchema.safeParse(
        buildSpec({
          type: "VerticalStackedBarChart",
          props: {
            title: "Removed",
            data: [
              {
                label: "Bucket 1",
                segments: [
                  { label: "A", value: 1 },
                  { label: "B", value: 2 },
                ],
              },
              {
                label: "Bucket 2",
                segments: [
                  { label: "A", value: 1 },
                  { label: "B", value: 2 },
                ],
              },
            ],
          },
        })
      ).success
    ).toBe(false);
  });
});
