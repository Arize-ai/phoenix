import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import { Flex, Text } from "@phoenix/components";
import { BarChart as BarChartComponent } from "@phoenix/components/agent/generativeUI/BarChart";
import { ChartFrame as ChartFrameComponent } from "@phoenix/components/agent/generativeUI/ChartFrame";
import { GenerativeUIPlaceholder } from "@phoenix/components/agent/generativeUI/GenerativeUIPlaceholder";
import { LineChart as LineChartComponent } from "@phoenix/components/agent/generativeUI/LineChart";
import { StackedBarChart as StackedBarChartComponent } from "@phoenix/components/agent/generativeUI/StackedBarChart";
import { VerticalBarChart as VerticalBarChartComponent } from "@phoenix/components/agent/generativeUI/VerticalBarChart";

/**
 * The elements PXI can render inline in a chat message from a generative UI
 * spec. Each story is one element, stacking the variants it supports.
 */
const meta: Meta = {
  title: "Domains/PXI/Generative UI",
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "padded",
    themeLayout: "row",
  },
};

export default meta;

/** One labeled entry in a variant stack. */
function Variant({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex direction="column" gap="size-100">
      <Text size="XS" color="text-500">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

function VariantStack({ children }: { children: ReactNode }) {
  return (
    <Flex direction="column" gap="size-300" width="100%">
      {children}
    </Flex>
  );
}

const issuesByCategoryChart = (
  <BarChartComponent
    title="Issues by Category"
    data={[
      { label: "Payment", value: 18 },
      { label: "Access", value: 12 },
      { label: "Performance", value: 9 },
      { label: "Data/Export", value: 5 },
      { label: "Other", value: 3 },
    ]}
  />
);

export const BarChart: StoryObj<typeof BarChartComponent> = {
  render: () => (
    <VariantStack>
      <Variant label="Basic">{issuesByCategoryChart}</Variant>
    </VariantStack>
  ),
};

export const LineChart: StoryObj<typeof LineChartComponent> = {
  render: () => (
    <VariantStack>
      <Variant label="Multiple series">
        <LineChartComponent
          title="Trend Comparison"
          lines={[
            {
              label: "Frustrated",
              data: [12, 15, 11, 18, 14, 20, 17, 22, 19, 25, 21, 18],
            },
            {
              label: "Resolved",
              data: [8, 10, 9, 12, 11, 14, 12, 15, 13, 17, 14, 12],
            },
          ]}
          xLabels={[
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ]}
        />
      </Variant>
    </VariantStack>
  ),
};

export const StackedBarChart: StoryObj<typeof StackedBarChartComponent> = {
  render: () => (
    <VariantStack>
      <Variant label="Basic">
        <StackedBarChartComponent
          title="Token Usage by User"
          data={[
            {
              label: "Sarah",
              segments: [
                { label: "opus-4-5", value: 2400 },
                { label: "opus-4-6", value: 1800 },
                { label: "haiku-4-5", value: 400 },
              ],
            },
            {
              label: "Michael",
              segments: [
                { label: "opus-4-5", value: 1200 },
                { label: "opus-4-6", value: 2100 },
                { label: "haiku-4-5", value: 900 },
              ],
            },
            {
              label: "Alex",
              segments: [
                { label: "opus-4-5", value: 800 },
                { label: "opus-4-6", value: 1400 },
                { label: "haiku-4-5", value: 1600 },
              ],
            },
            {
              label: "Jordan",
              segments: [
                { label: "opus-4-5", value: 1900 },
                { label: "opus-4-6", value: 600 },
                { label: "haiku-4-5", value: 200 },
              ],
            },
            {
              label: "Taylor",
              segments: [
                { label: "opus-4-5", value: 500 },
                { label: "opus-4-6", value: 1100 },
                { label: "haiku-4-5", value: 800 },
              ],
            },
          ]}
        />
      </Variant>
      <Variant label="Two segments">
        <StackedBarChartComponent
          title="Cache Hit Ratio"
          data={[
            {
              label: "API",
              segments: [
                { label: "Hit", value: 850 },
                { label: "Miss", value: 150 },
              ],
            },
            {
              label: "DB",
              segments: [
                { label: "Hit", value: 720 },
                { label: "Miss", value: 280 },
              ],
            },
            {
              label: "Redis",
              segments: [
                { label: "Hit", value: 950 },
                { label: "Miss", value: 50 },
              ],
            },
          ]}
        />
      </Variant>
      <Variant label="No title">
        <StackedBarChartComponent
          title={null}
          data={[
            {
              label: "Q1",
              segments: [
                { label: "Revenue", value: 1200 },
                { label: "Costs", value: 800 },
              ],
            },
            {
              label: "Q2",
              segments: [
                { label: "Revenue", value: 1400 },
                { label: "Costs", value: 850 },
              ],
            },
          ]}
        />
      </Variant>
    </VariantStack>
  ),
};

export const VerticalBarChart: StoryObj<typeof VerticalBarChartComponent> = {
  render: () => (
    <VariantStack>
      <Variant label="Basic">
        <VerticalBarChartComponent
          title="Requests per Hour"
          data={[
            { label: "00", value: 120 },
            { label: "04", value: 45 },
            { label: "08", value: 230 },
            { label: "12", value: 380 },
            { label: "16", value: 420 },
            { label: "20", value: 290 },
          ]}
        />
      </Variant>
      <Variant label="With highlight">
        <VerticalBarChartComponent
          title="Daily Volume (Last 30 Days, 3-Day Buckets)"
          data={[
            { label: "Apr 15-17", value: 18, highlight: 2 },
            { label: "Apr 18-20", value: 22, highlight: 0 },
            { label: "Apr 21-23", value: 17, highlight: 1 },
            { label: "Apr 24-26", value: 25, highlight: 3 },
            { label: "Apr 27-29", value: 21, highlight: 0 },
            { label: "Apr 30-May 2", value: 28, highlight: 4 },
            { label: "May 3-5", value: 24, highlight: 2 },
            { label: "May 6-8", value: 19, highlight: 1 },
            { label: "May 9-11", value: 27, highlight: 3 },
            { label: "May 12-14", value: 23, highlight: 2 },
          ]}
          baseLabel="Traces"
          highlightLabel="Errors"
        />
      </Variant>
    </VariantStack>
  ),
};

export const ChartFrame: StoryObj<typeof ChartFrameComponent> = {
  render: () => (
    <VariantStack>
      <Variant label="With title">
        <ChartFrameComponent title="Custom Chart Container">
          <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
            Chart content goes here
          </div>
        </ChartFrameComponent>
      </Variant>
      <Variant label="Without title">
        <ChartFrameComponent title={null}>
          <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
            Chart without title
          </div>
        </ChartFrameComponent>
      </Variant>
    </VariantStack>
  ),
};

export const Placeholder: StoryObj<typeof GenerativeUIPlaceholder> = {
  render: () => (
    <VariantStack>
      <Variant label="Default">
        <GenerativeUIPlaceholder message="Generative UI was requested, but no renderable spec was found." />
      </Variant>
      <Variant label="Unsupported element">
        <GenerativeUIPlaceholder message="Unsupported generative UI element: PieChart" />
      </Variant>
      <Variant label="Error">
        <GenerativeUIPlaceholder message="Generative UI could not be rendered due to invalid data." />
      </Variant>
    </VariantStack>
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<typeof BarChartComponent> = {
  render: () => issuesByCategoryChart,
  tags: ["!dev", "!autodocs"],
};
