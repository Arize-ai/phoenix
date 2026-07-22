import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  MenuContainer,
  MenuTrigger,
  Text,
} from "@phoenix/components";
import { MetricsChartSelector } from "@phoenix/components/chart";
import type { ProjectMetricChartKey } from "@phoenix/pages/project/constants";
import { MAX_SELECTED_METRIC_CHARTS } from "@phoenix/pages/project/constants";
import { PROJECT_METRIC_CHARTS } from "@phoenix/pages/project/metrics/chartCatalog";

/**
 * A generic, store-agnostic chart picker. Given a catalog of chart options it
 * lets the user choose which charts appear in a view, capped at `maxSelected`.
 * Here it is wired to the project metric chart catalog, the same way the strip
 * above a project's spans/traces/sessions table uses it.
 *
 * The interaction to notice: toggling a chart does NOT make rows jump between
 * the "Selected" and "Available" sections. The partition is frozen when the
 * menu opens and only re-snapshots the next time it is opened — GitHub's label
 * picker behavior. Each row carries a small preview glyph of the chart's shape
 * (vertical bars, a ranked horizontal chart, or a line).
 */
const meta: Meta<typeof MetricsChartSelector> = {
  title: "Chart/MetricsChartSelector",
  component: MetricsChartSelector,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof MetricsChartSelector>;

function InteractiveSelector({
  initialKeys = [],
}: {
  initialKeys?: ProjectMetricChartKey[];
}) {
  const [selectedKeys, setSelectedKeys] =
    useState<ProjectMetricChartKey[]>(initialKeys);
  return (
    <Flex direction="column" gap="size-200" alignItems="start">
      <MenuTrigger>
        <Button aria-label="Select metric charts">
          <Flex direction="row" alignItems="center" gap="size-100">
            <Icon svg={<Icons.BarChart />} />
            Charts
          </Flex>
        </Button>
        <MenuContainer placement="bottom start">
          <MetricsChartSelector
            options={PROJECT_METRIC_CHARTS}
            selectedKeys={selectedKeys}
            maxSelected={MAX_SELECTED_METRIC_CHARTS}
            onSelectionChange={setSelectedKeys}
          />
        </MenuContainer>
      </MenuTrigger>
      <Text size="XS" color="text-700">
        Selected: {selectedKeys.length > 0 ? selectedKeys.join(", ") : "none"}
      </Text>
    </Flex>
  );
}

/**
 * Opens with a couple of charts already selected. Note the frozen "Selected"
 * section — unchecking a selected chart keeps it in place rather than dropping
 * it to "Available".
 */
export const Default: Story = {
  render: () => <InteractiveSelector initialKeys={["traces", "latency"]} />,
};

/**
 * Nothing selected yet: a single flat list with no "Selected" section. Checking
 * a chart adds a checkmark in place; the "Selected" section only appears the
 * next time the menu is opened.
 */
export const Empty: Story = {
  render: () => <InteractiveSelector />,
};

/**
 * Opens at the selection limit. The unselected charts are disabled until the
 * user removes one, so the strip never exceeds {@link MAX_SELECTED_METRIC_CHARTS}.
 */
export const AtSelectionLimit: Story = {
  render: () => (
    <InteractiveSelector initialKeys={["traffic", "traces", "latency"]} />
  ),
};
