import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import type { ComponentProps, ReactNode } from "react";

import type { ToggleButtonProps } from "@phoenix/components";
import {
  Flex,
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A button that stays pressed until it is pressed again, for turning on a
 * mode that stays on, such as annotating a span or taking notes.
 *
 * `ToggleButtonGroup` joins several toggle buttons into one bar and sets
 * their size. It allows single or multiple selection and, unlike
 * `SegmentedControl`, can be left with nothing selected. For a compact
 * choice that always has exactly one selection, use `SegmentedControl`.
 *
 * Some options are accepted but not styled yet: size `L` has no height or
 * padding, so it is smaller than `S`, and a group given
 * `orientation="vertical"` still lays its buttons out in a row.
 */
const meta: Meta = {
  title: "Design System/Actions/Toggle Button",
  tags: ["updated", "unreviewed", "incomplete"],
  component: ToggleButton,
  subcomponents: { ToggleButtonGroup },
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

export const Default: StoryFn = () => (
  <ToggleButton size="S" leadingVisual={<Icon svg={<Icons.Edit2 />} />}>
    Annotate Session
  </ToggleButton>
);
Default.tags = ["!dev"];

const SIZES: NonNullable<ToggleButtonProps["size"]>[] = ["S", "M", "L"];

const SELECTION_ROWS = [false, true].flatMap((isSelected) =>
  SIZES.map((size) => ({
    label: `${isSelected ? "selected" : "unselected"} · ${size}`,
    code: true,
    isSelected,
    size,
  }))
);

const CONTENT_COLUMNS: {
  label: string;
  props: Partial<ToggleButtonProps>;
  children?: ReactNode;
}[] = [
  { label: "Plain", props: {}, children: "Annotate" },
  {
    label: "Leading visual",
    props: { leadingVisual: <Icon svg={<Icons.Edit2 />} /> },
    children: "Annotate",
  },
  {
    label: "Trailing visual",
    props: { trailingVisual: <Icon svg={<Icons.Edit2 />} /> },
    children: "Annotate",
  },
  {
    label: "Icon only",
    props: {
      "aria-label": "Live",
      leadingVisual: <Icon svg={<Icons.Play />} />,
    },
  },
];

export const SelectionAndSizes: StoryFn = () => (
  <OptionGrid
    rows={SELECTION_ROWS}
    columns={CONTENT_COLUMNS}
    renderCell={(row, column) =>
      column ? (
        <ToggleButton
          size={row.size}
          defaultSelected={row.isSelected}
          {...column.props}
        >
          {column.children}
        </ToggleButton>
      ) : null
    }
  />
);
SelectionAndSizes.storyName = "Selection and Sizes";
SelectionAndSizes.tags = ["!dev"];
SelectionAndSizes.parameters = { themeLayout: "column" };

const STATES: { label: string; props: Partial<ToggleButtonProps> }[] = [
  { label: "", props: {} },
  { label: "isDisabled", props: { isDisabled: true } },
];

export const ContentAndStates: StoryFn = () => (
  <OptionGrid
    rows={[false, true].flatMap((isSelected) =>
      STATES.map((state) => {
        const selection = isSelected ? "selected" : "unselected";
        return {
          label: state.label ? `${selection} · ${state.label}` : selection,
          code: true,
          isSelected,
          props: state.props,
        };
      })
    )}
    columns={CONTENT_COLUMNS}
    renderCell={(row, column) =>
      column ? (
        <ToggleButton
          defaultSelected={row.isSelected}
          {...row.props}
          {...column.props}
        >
          {column.children}
        </ToggleButton>
      ) : null
    }
  />
);
ContentAndStates.storyName = "Content and States";
ContentAndStates.tags = ["!dev"];
ContentAndStates.parameters = { themeLayout: "column" };

const INTEGRATIONS = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "langchain", name: "LangChain" },
];

const CHART_TYPES = [
  { id: "column", name: "Vertical bars", svg: <Icons.ChartNoAxesColumn /> },
  { id: "bar", name: "Horizontal bars", svg: <Icons.ChartBarDecreasing /> },
  { id: "line", name: "Line", svg: <Icons.ChartLine /> },
];

type GroupRenderProps = Partial<ComponentProps<typeof ToggleButtonGroup>> & {
  isMultiSelect?: boolean;
};

const GROUP_CONTENT: {
  label: string;
  renderGroup: (props: GroupRenderProps) => ReactNode;
}[] = [
  {
    label: "Text",
    renderGroup: ({ isMultiSelect, ...props }) => (
      <ToggleButtonGroup
        aria-label="Integration"
        selectionMode={isMultiSelect ? "multiple" : "single"}
        defaultSelectedKeys={
          isMultiSelect ? ["openai", "langchain"] : ["openai"]
        }
        {...props}
      >
        {INTEGRATIONS.map(({ id, name }) => (
          <ToggleButton key={id} id={id}>
            {name}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    ),
  },
  {
    label: "Icon only",
    renderGroup: ({ isMultiSelect, ...props }) => (
      <ToggleButtonGroup
        aria-label="Chart type"
        selectionMode={isMultiSelect ? "multiple" : "single"}
        defaultSelectedKeys={isMultiSelect ? ["column", "line"] : ["column"]}
        {...props}
      >
        {CHART_TYPES.map(({ id, name, svg }) => (
          <ToggleButton
            key={id}
            id={id}
            aria-label={name}
            leadingVisual={<Icon svg={svg} />}
          />
        ))}
      </ToggleButtonGroup>
    ),
  },
];

export const GroupSizes: StoryFn = () => (
  <OptionGrid
    rows={SIZES.map((size) => ({ label: size, code: true, size }))}
    columns={GROUP_CONTENT}
    renderCell={(row, column) => column?.renderGroup({ size: row.size })}
  />
);
GroupSizes.tags = ["!dev"];
GroupSizes.parameters = { themeLayout: "column" };

const GROUP_MODES: { label: string; props: GroupRenderProps }[] = [
  { label: "Single select", props: {} },
  { label: "Multi select", props: { isMultiSelect: true } },
];

const GROUP_STATES: { label: string; props: GroupRenderProps }[] = [
  { label: "", props: {} },
  { label: "disabled", props: { isDisabled: true } },
];

export const GroupStates: StoryFn = () => (
  <OptionGrid
    rows={GROUP_MODES.flatMap((mode) =>
      GROUP_STATES.map((state) => ({
        label: state.label ? `${mode.label}, ${state.label}` : mode.label,
        props: { ...mode.props, ...state.props },
      }))
    )}
    columns={GROUP_CONTENT}
    renderCell={(row, column) => column?.renderGroup(row.props)}
  />
);
GroupStates.storyName = "Group States";
GroupStates.tags = ["!dev"];
GroupStates.parameters = { themeLayout: "column" };

export const GroupOrientations: StoryFn = () => (
  <OptionGrid
    rows={(["horizontal", "vertical"] as const).map((orientation) => ({
      label: orientation,
      code: true,
      orientation,
    }))}
    columns={GROUP_CONTENT}
    renderCell={(row, column) =>
      column?.renderGroup({ orientation: row.orientation })
    }
  />
);
GroupOrientations.storyName = "Group Orientations";
GroupOrientations.tags = ["!dev"];
GroupOrientations.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Flex direction="row" gap="size-100">
      <ToggleButton defaultSelected>Selected</ToggleButton>
      <ToggleButton>Unselected</ToggleButton>
    </Flex>
  ),
};
