import type { Meta, StoryObj } from "@storybook/react";

import { SpanMetricsDetailsView } from "@phoenix/components/trace/SpanMetricsDetailsView";

/**
 * The breakdown behind a span's metrics row, drawn from plain values. The
 * connected variants in `SpanMetricsDetails.tsx` feed it from a Relay
 * fragment, a lazy query, or a preloaded query; this is what they all render.
 */
const meta: Meta<typeof SpanMetricsDetailsView> = {
  title: "Trace/SpanMetricsDetailsView",
  component: SpanMetricsDetailsView,
  parameters: {
    width: 320,
    controls: { disable: true },
  },
};

export default meta;
type Story = StoryObj<typeof SpanMetricsDetailsView>;

/** An LLM span with cached prompt tokens and pricing applied. */
export const Full: Story = {
  args: {
    tokens: {
      total: 4821,
      prompt: 3471,
      completion: 1350,
      promptDetails: { input: 2256, cache_read: 1215 },
    },
    costs: {
      total: 0.0212,
      prompt: 0.00848,
      completion: 0.01272,
      promptDetails: { input: 0.0067, cache_read: 0.0017 },
    },
  },
};

/** A local model: tokens are counted but nothing is priced. */
export const TokensWithoutCost: Story = {
  args: {
    tokens: { total: 812, prompt: 600, completion: 212 },
  },
};
