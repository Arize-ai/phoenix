import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import {
  Icon,
  Icons,
  MenuButton,
  MenuButtonValue,
  SelectChevronUpDownIcon,
} from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A menu trigger that shows the current selection, as the project picker
 * does. `MenuButtonValue` holds the selection: it truncates a long value
 * and styles the placeholder shown before anything is selected.
 *
 * It accepts every `Button` prop; its variants are shown under `Button`.
 */
const meta = {
  title: "Design System/Menus/Menu Button",
  tags: ["updated", "unreviewed", "incomplete"],
  component: MenuButton,
  subcomponents: { MenuButtonValue },
  parameters: {
    layout: "centered",
    themeLayout: "column",
    controls: { disable: true },
  },
} satisfies Meta<typeof MenuButton>;

export default meta;
type Story = StoryObj<typeof meta>;

type Value = { label: string; text: string; isPlaceholder?: boolean };

const VALUES: Value[] = [
  { label: "Value", text: "default" },
  { label: "Placeholder", text: "Select project", isPlaceholder: true },
  {
    label: "Long value",
    text: "customer-support-agent-production-traces",
  },
];

const fillCSS = css`
  width: 100%;
`;

function ProjectMenuButton({
  value,
  size,
  isDisabled,
}: {
  value: Value;
  size?: "S" | "M" | "L";
  isDisabled?: boolean;
}) {
  return (
    <MenuButton
      aria-label={value.isPlaceholder ? "Project" : `Project: ${value.text}`}
      css={fillCSS}
      size={size}
      isDisabled={isDisabled}
      leadingVisual={<Icon svg={<Icons.Trace />} />}
      trailingVisual={<SelectChevronUpDownIcon />}
    >
      <MenuButtonValue isPlaceholder={value.isPlaceholder}>
        {value.text}
      </MenuButtonValue>
    </MenuButton>
  );
}

export const Default: Story = {
  tags: ["!dev"],
  render: () => (
    <div style={{ width: 240 }}>
      <ProjectMenuButton value={VALUES[0]} />
    </div>
  ),
};

/**
 * Size `L` has no styling of its own: it renders shorter than `S`, as
 * `Button` does.
 */
export const ValuesAndSizes: Story = {
  tags: ["!dev"],
  render: () => (
    <OptionGrid
      rows={VALUES}
      columns={[
        { label: "S", code: true },
        { label: "M", code: true },
        { label: "L", code: true },
        { label: "disabled" },
      ]}
      cellWidth="180px"
      renderCell={(value, column) => (
        <div style={{ width: 180 }}>
          <ProjectMenuButton
            value={value}
            size={
              column?.label === "disabled"
                ? undefined
                : (column?.label as "S" | "M" | "L")
            }
            isDisabled={column?.label === "disabled"}
          />
        </div>
      )}
    />
  ),
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ width: 240 }}>
      <ProjectMenuButton value={VALUES[2]} />
    </div>
  ),
};
