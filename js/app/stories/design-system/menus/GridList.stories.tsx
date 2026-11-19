import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

import {
  Flex,
  GridList,
  GridListItem,
  GridListSection,
  GridListSectionTitle,
  Icon,
  IconButton,
  Icons,
  Text,
} from "@phoenix/components";
import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";
import { CompactEmptyState } from "@phoenix/components/core/empty";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A menu list whose rows can hold their own controls, such as the edit
 * button beside each evaluator in the playground's evaluator picker. Where
 * a `Menu` item is one action, a grid list row is a selectable row with a
 * checkbox, an optional subtitle, and trailing controls that work on their
 * own. It sits in a `MenuContainer` beside or instead of a `Menu`; see
 * `Composition`.
 */
const meta = {
  title: "Design System/Menus/Grid List",
  tags: ["updated", "unreviewed", "incomplete"],
  component: GridList,
  subcomponents: { GridListItem, GridListSection, GridListSectionTitle },
  parameters: {
    layout: "centered",
    themeLayout: "row",
    controls: { disable: true },
  },
} satisfies Meta<typeof GridList>;

export default meta;
type Story = StoryObj<typeof meta>;

const LIST_WIDTH = 300;

const EVALUATORS = [
  { id: "correctness", annotationName: "correctness" },
  { id: "hallucination", annotationName: "hallucination" },
  { id: "qa-relevance", annotationName: undefined },
];

function EditButton() {
  return (
    <IconButton size="S" aria-label="Edit evaluator">
      <Icon svg={<Icons.Edit />} />
    </IconButton>
  );
}

function AnnotationSubtitle({ name }: { name: string }) {
  return (
    <AnnotationNameAndValue
      annotation={{ name }}
      displayPreference="none"
      size="XS"
      maxWidth="unset"
    />
  );
}

function List({
  label,
  children,
  width = LIST_WIDTH,
  ...props
}: {
  label: string;
  children?: ReactNode;
  width?: number;
  selectionMode?: "none" | "single" | "multiple";
  selectedKeys?: string[];
  disabledKeys?: string[];
  renderEmptyState?: () => ReactNode;
}) {
  return (
    <div style={{ width }}>
      <GridList aria-label={label} {...props}>
        {children}
      </GridList>
    </div>
  );
}

function EvaluatorItems() {
  return EVALUATORS.map(({ id, annotationName }) => (
    <GridListItem
      key={id}
      id={id}
      textValue={id}
      subtitle={
        annotationName ? (
          <AnnotationSubtitle name={annotationName} />
        ) : undefined
      }
      trailingContent={<EditButton />}
    >
      <Text>{id}</Text>
    </GridListItem>
  ));
}

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <List
      label="Select evaluators"
      selectionMode="multiple"
      selectedKeys={["correctness"]}
    >
      <EvaluatorItems />
    </List>
  ),
};

/**
 * Only `multiple` shows a selection: its checkboxes. A selected row in
 * `single` mode has no styling and looks like an unselected one.
 */
export const SelectionModes: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={[
        { label: "none", code: true, selected: [] },
        { label: "single", code: true, selected: ["hallucination"] },
        { label: "multiple", code: true, selected: ["correctness"] },
      ]}
      alignRows="start"
      renderCell={(row) => (
        <List
          label="Select evaluators"
          selectionMode={row.label as "none" | "single" | "multiple"}
          selectedKeys={row.selected}
        >
          <EvaluatorItems />
        </List>
      )}
    />
  ),
};

const CONTENT = [
  { label: "Plain" },
  { label: "Subtitle" },
  { label: "Trailing icon button" },
  { label: "Subtitle and trailing" },
] as const;

const STATES = [
  { label: "enabled" },
  { label: "disabled" },
  { label: "selected" },
] as const;

export const ContentAndStates: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={CONTENT}
      columns={STATES}
      renderCell={(row, column) => (
        <List
          label="Evaluator"
          width={250}
          selectionMode="multiple"
          selectedKeys={column?.label === "selected" ? ["item"] : []}
          disabledKeys={column?.label === "disabled" ? ["item"] : []}
        >
          <GridListItem
            id="item"
            textValue="correctness"
            subtitle={
              row.label.startsWith("Subtitle") ? (
                <AnnotationSubtitle name="correctness" />
              ) : undefined
            }
            trailingContent={
              row.label.includes("railing") ? <EditButton /> : undefined
            }
          >
            <Text>correctness</Text>
          </GridListItem>
        </List>
      )}
    />
  ),
  parameters: { themeLayout: "column" },
};

export const Sections: Story = {
  tags: ["!dev"],
  render: () => (
    <List label="Select evaluators" selectionMode="multiple">
      <GridListSection>
        <GridListSectionTitle title="LLM evaluators" />
        <GridListItem id="correctness">correctness</GridListItem>
        <GridListItem id="hallucination">hallucination</GridListItem>
      </GridListSection>
      <GridListSection>
        <GridListSectionTitle title="Code evaluators" />
        <GridListItem id="exact-match">exact-match</GridListItem>
        <GridListItem id="regex-match">regex-match</GridListItem>
      </GridListSection>
    </List>
  ),
};

export const ContentLength: Story = {
  tags: ["!dev"],
  render: () => (
    <Flex direction="row" gap="size-300" alignItems="start">
      {[0, 1, 5].map((count) => (
        <List
          key={count}
          width={250}
          label="Select evaluators"
          selectionMode="multiple"
          renderEmptyState={() => (
            <CompactEmptyState
              icon={<Icon svg={<Icons.Scale />} />}
              description="No evaluators"
            />
          )}
        >
          {Array.from({ length: count }, (_, index) => (
            <GridListItem key={index} id={`evaluator-${index}`}>
              {`evaluator-${index + 1}`}
            </GridListItem>
          ))}
        </List>
      ))}
    </Flex>
  ),
  parameters: { themeLayout: "column" },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <List
      label="Select evaluators"
      selectionMode="multiple"
      selectedKeys={["correctness"]}
    >
      <EvaluatorItems />
    </List>
  ),
};
