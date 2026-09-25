import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { Selection } from "react-aria-components";

import { ListBox, ListBoxItem } from "@phoenix/components";
import { LAST_N_TIME_RANGES } from "@phoenix/components/datetime/constants";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A list of options to pick from, the list inside a select, a combo box and
 * the time range presets. A disabled item has no styling: it cannot be
 * pressed or hovered, but it looks like any other item. Hover and keyboard
 * focus are drawn only while the pointer or focus is on an item, so they are
 * not shown here.
 */
const meta: Meta = {
  title: "Design System/Forms/List Box",
  component: ListBox,
  subcomponents: { ListBoxItem },
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const SELECTION_MODES: {
  label: string;
  selectionMode: "none" | "single" | "multiple";
  defaultSelectedKeys: Selection;
}[] = [
  {
    label: "Not selectable",
    selectionMode: "none",
    defaultSelectedKeys: new Set(),
  },
  {
    label: "Single select",
    selectionMode: "single",
    defaultSelectedKeys: new Set(["1h"]),
  },
  {
    label: "Multi select",
    selectionMode: "multiple",
    defaultSelectedKeys: new Set(["1h", "7d"]),
  },
];

const SELECTION: { label: string; isSelected: boolean }[] = [
  { label: "Unselected", isSelected: false },
  { label: "Selected", isSelected: true },
];

const STATES: { label: string; isItemDisabled: boolean }[] = [
  { label: "Enabled", isItemDisabled: false },
  { label: "Disabled", isItemDisabled: true },
];

const DATASET_NAMES = [
  "qa-golden-set",
  "support-tickets",
  "rag-eval-questions",
  "summarization-benchmarks",
  "tool-calling-traces",
  "customer-feedback",
  "sql-generation",
  "hallucination-probe",
  "code-review-comments",
  "multilingual-intents",
  "onboarding-chats",
  "refund-requests",
  "product-descriptions",
  "legal-clauses",
  "search-queries",
  "chat-escalations",
  "voice-transcripts",
  "policy-questions",
  "agent-trajectories",
  "red-team-prompts",
  "faq-pairs",
  "invoice-extraction",
  "email-triage",
  "json-extraction",
  "safety-refusals",
];

const ITEM_COUNTS: { label: string; names: string[] }[] = [
  { label: "Empty", names: [] },
  { label: "1 item", names: DATASET_NAMES.slice(0, 1) },
  { label: "5 items", names: DATASET_NAMES.slice(0, 5) },
  { label: "25 items", names: DATASET_NAMES },
];

const TEXT_LENGTHS: { label: string; name: string }[] = [
  { label: "1 character", name: "a" },
  { label: "Regular", name: "qa-golden-set" },
  {
    label: "Long",
    name: "customer-support-regression-suite-2026-q3-with-annotated-edge-cases",
  },
];

function TimeRangeListBox({
  selectionMode = "single",
  defaultSelectedKeys = new Set(["1h"]),
}: {
  selectionMode?: "none" | "single" | "multiple";
  defaultSelectedKeys?: Selection;
}) {
  return (
    <ListBox
      aria-label="Time range"
      selectionMode={selectionMode}
      defaultSelectedKeys={defaultSelectedKeys}
      items={LAST_N_TIME_RANGES}
      style={{ width: 180 }}
    >
      {(range) => <ListBoxItem id={range.key}>{range.label}</ListBoxItem>}
    </ListBox>
  );
}

function DatasetListBox({ names }: { names: string[] }) {
  return (
    <ListBox
      aria-label="Dataset"
      selectionMode="single"
      renderEmptyState={() => "No datasets"}
      style={{ width: 220, minHeight: 36 }}
    >
      {names.map((name) => (
        <ListBoxItem key={name} id={name}>
          {name}
        </ListBoxItem>
      ))}
    </ListBox>
  );
}

export const Default: StoryFn = () => <TimeRangeListBox />;
Default.tags = ["!dev"];

export const SelectionModes: StoryFn = () => (
  <OptionGrid
    columns={SELECTION_MODES}
    renderCell={(_row, mode) => (
      <TimeRangeListBox
        selectionMode={mode?.selectionMode}
        defaultSelectedKeys={mode?.defaultSelectedKeys}
      />
    )}
  />
);
SelectionModes.tags = ["!dev"];
SelectionModes.parameters = { themeLayout: "column" };

export const SelectionAndStates: StoryFn = () => (
  <OptionGrid
    rows={SELECTION}
    columns={STATES}
    renderCell={(selection, state) => (
      <ListBox
        aria-label="Time range"
        selectionMode="single"
        defaultSelectedKeys={selection.isSelected ? ["1h"] : []}
        disabledKeys={state?.isItemDisabled ? ["1h"] : []}
        style={{ width: 160 }}
      >
        <ListBoxItem id="1h">Last Hour</ListBoxItem>
      </ListBox>
    )}
  />
);
SelectionAndStates.tags = ["!dev"];
SelectionAndStates.parameters = { themeLayout: "row" };

export const ItemCount: StoryFn = () => (
  <OptionGrid
    columns={ITEM_COUNTS}
    alignRows="start"
    renderCell={(_row, count) => (
      <div style={{ maxHeight: 240, display: "flex" }}>
        <DatasetListBox names={count?.names ?? []} />
      </div>
    )}
  />
);
ItemCount.tags = ["!dev"];
ItemCount.parameters = { themeLayout: "column" };

export const ItemTextLength: StoryFn = () => (
  <OptionGrid
    rows={TEXT_LENGTHS}
    renderCell={(length) => <DatasetListBox names={[length.name]} />}
  />
);
ItemTextLength.tags = ["!dev"];
ItemTextLength.parameters = { themeLayout: "row" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <ListBox
      aria-label="Time range"
      selectionMode="single"
      defaultSelectedKeys={["1h"]}
      items={LAST_N_TIME_RANGES.slice(0, 4)}
      style={{ width: 200 }}
    >
      {(range) => <ListBoxItem id={range.key}>{range.label}</ListBoxItem>}
    </ListBox>
  ),
};
