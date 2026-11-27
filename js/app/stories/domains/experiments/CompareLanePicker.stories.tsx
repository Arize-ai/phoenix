import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import type { ExperimentCompareLanePickerOption } from "@phoenix/pages/experiment/compareSlideover/ExperimentCompareLanePicker";
import { ExperimentCompareLanePicker } from "@phoenix/pages/experiment/compareSlideover/ExperimentCompareLanePicker";

import { OptionGrid } from "../../utils/OptionGrid";

const OPTIONS: ExperimentCompareLanePickerOption[] = [
  {
    id: "experiment-13",
    name: "pg::gpt-5-mini::0fa948e5",
    sequenceNumber: 13,
    color: "var(--global-color-blue-500)",
  },
  {
    id: "experiment-14",
    name: "pg::gpt-5::7c21d0ab",
    sequenceNumber: 14,
    color: "var(--global-color-purple-500)",
  },
  {
    id: "experiment-15",
    name: "pg::gpt-4.1::b19e4402",
    sequenceNumber: 15,
    color: "var(--global-color-magenta-500)",
  },
  {
    id: "experiment-16",
    name: "pg::claude-opus-5::51c0e7aa",
    sequenceNumber: 16,
    color: "var(--global-color-orange-500)",
  },
  {
    id: "experiment-17",
    name: "pg::claude-sonnet-5::9d4f2b10",
    sequenceNumber: 17,
    color: "var(--global-color-seafoam-500)",
  },
];

function PickerAtWidth({
  width,
  options,
  defaultSelectedExperimentId,
}: {
  width: number;
  options: ExperimentCompareLanePickerOption[];
  defaultSelectedExperimentId: string;
}) {
  const [selectedExperimentId, setSelectedExperimentId] = useState(
    defaultSelectedExperimentId
  );
  return (
    <div style={{ width, maxWidth: "100%", display: "flex" }}>
      <ExperimentCompareLanePicker
        options={options}
        selectedExperimentId={selectedExperimentId}
        onSelectionChange={setSelectedExperimentId}
      />
    </div>
  );
}

const meta: Meta<typeof ExperimentCompareLanePicker> = {
  title: "Domains/Experiments/Compare Lane Picker",
  component: ExperimentCompareLanePicker,
  tags: ["updated", "complete", "unreviewed"],
};

export default meta;
type Story = StoryObj<typeof ExperimentCompareLanePicker>;

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <PickerAtWidth
      width={480}
      options={OPTIONS.slice(0, 3)}
      defaultSelectedExperimentId="experiment-14"
    />
  ),
};

const WIDTHS = [
  { id: "640", label: "640px, every experiment fits", width: 640 },
  { id: "420", label: "420px, two overflow", width: 420 },
  { id: "260", label: "260px, only the selected chip fits", width: 260 },
] as const;

const SELECTIONS = [
  { id: "experiment-13", label: "First selected" },
  { id: "experiment-17", label: "Last selected" },
] as const;

export const Overflow: Story = {
  tags: ["!dev"],
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      rows={WIDTHS}
      columns={SELECTIONS}
      justifyCells="start"
      renderCell={(row, column) => (
        <PickerAtWidth
          width={row.width}
          options={OPTIONS}
          defaultSelectedExperimentId={column?.id ?? "experiment-13"}
        />
      )}
    />
  ),
};
