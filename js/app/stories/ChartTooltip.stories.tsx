import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Text } from "@phoenix/components";
import type { ColorPreviewShape } from "@phoenix/components/chart";
import {
  ChartTooltip,
  ChartTooltipDivider,
  ChartTooltipItem,
} from "@phoenix/components/chart";
import { ExperimentMetricsTooltipHeader } from "@phoenix/pages/dataset/metrics/ExperimentMetricsTooltipHeader";

type TooltipItem = {
  color: string;
  name: string;
  shape: ColorPreviewShape;
  value: string;
};

const DEFAULT_TOOLTIP_ITEMS: readonly TooltipItem[] = [
  {
    color: "var(--global-color-blue-700)",
    name: "correctness",
    shape: "line",
    value: "0.91",
  },
  {
    color: "var(--global-color-green-700)",
    name: "groundedness",
    shape: "line",
    value: "0.86",
  },
];

const LONG_EVALUATOR_TOOLTIP_ITEMS: readonly TooltipItem[] = [
  {
    color: "var(--global-color-blue-700)",
    name: "policy compliance, semantic groundedness, citation completeness, and escalation decision quality for the customer support response",
    shape: "line",
    value: "0.91",
  },
  {
    color: "var(--global-color-green-700)",
    name: "groundedness_verification_with_retrieval_context_attribution_citation_coverage_policy_compliance_escalation_detection_and_response_quality_score",
    shape: "line",
    value: "0.76",
  },
  {
    color: "var(--global-color-orange-700)",
    name: "quality gate [production / multilingual / safety-sensitive] — verify answer, sources, uncertainty, policy, tone, and next-step guidance",
    shape: "line",
    value: "0.63",
  },
];

const LONG_LABEL_TOOLTIP_ITEMS: readonly TooltipItem[] = [
  {
    color: "var(--global-color-blue-700)",
    name: "passes all quality gates with complete citations and no unsupported claims, but still requires a human reviewer before production release",
    shape: "square",
    value: "40%",
  },
  {
    color: "var(--global-color-green-700)",
    name: "needs_human_review_due_to_policy_ambiguity_and_insufficient_source_attribution_before_this_response_can_be_released_to_the_customer",
    shape: "square",
    value: "40%",
  },
  {
    color: "var(--global-color-orange-700)",
    name: "conditionally acceptable — grounded and helpful; escalation owner, regional policy exception, and final approval are still unresolved",
    shape: "square",
    value: "20%",
  },
];

const tooltipItemListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  margin: 0;
  padding: 0;
  list-style: none;
`;

function TooltipItemList({ items }: { items: readonly TooltipItem[] }) {
  return (
    <ul css={tooltipItemListCSS}>
      {items.map((item) => (
        <li key={item.name}>
          <ChartTooltipItem {...item} />
        </li>
      ))}
    </ul>
  );
}

function ExperimentChartTooltip({
  experimentName,
  isBaseline = false,
  items,
}: {
  experimentName: string;
  isBaseline?: boolean;
  items: readonly TooltipItem[];
}) {
  return (
    <ChartTooltip>
      <ExperimentMetricsTooltipHeader
        sequenceNumber={8}
        name={experimentName}
        isBaseline={isBaseline}
      />
      <TooltipItemList items={items} />
    </ChartTooltip>
  );
}

const meta: Meta<typeof ChartTooltip> = {
  title: "Charting/Chart Tooltip",
  component: ChartTooltip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ChartTooltip>;

export const Default: Story = {
  render: () => (
    <ExperimentChartTooltip
      experimentName="candidate 07"
      items={DEFAULT_TOOLTIP_ITEMS}
    />
  ),
};

/**
 * Multiple long evaluator names exercise tooltip item wrapping independently
 * of the caller-provided tooltip header.
 */
export const LongEvaluatorNames: Story = {
  render: () => (
    <ExperimentChartTooltip
      experimentName="candidate 07"
      isBaseline
      items={LONG_EVALUATOR_TOOLTIP_ITEMS}
    />
  ),
};

/**
 * Categorical annotation summaries can contain user-defined labels that are
 * much longer than their percentage values.
 */
export const LongLabelNames: Story = {
  render: () => (
    <ChartTooltip>
      <Text weight="heavy" size="S">
        categorical label breakdown
      </Text>
      <ChartTooltipDivider />
      <TooltipItemList items={LONG_LABEL_TOOLTIP_ITEMS} />
    </ChartTooltip>
  ),
};
