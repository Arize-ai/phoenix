import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import {
  Button,
  Group,
  Icon,
  IconButton,
  Icons,
  Separator,
  ToggleButton,
  Toolbar,
} from "@phoenix/components";

/**
 * Toolbar
 * ========
 * A container for a set of interactive controls such as buttons or toggle buttons.
 * Inspired by the React Aria `Toolbar` pattern: https://react-spectrum.adobe.com/react-aria/Toolbar.html
 *
 * This story demonstrates both horizontal and vertical orientations, as well as the use of `Separator`s
 * to visually divide groups of controls.
 */

const meta: Meta<typeof Toolbar> = {
  title: "Toolbar",
  component: Toolbar,
  subcomponents: { Separator },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A toolbar is a container for a set of interactive controls. It supports horizontal or vertical orientation and arrow-key navigation between its children.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: { type: "select" },
      options: ["horizontal", "vertical"],
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

type ToolbarStoryArgs = {
  orientation?: "horizontal" | "vertical";
};

const Template: StoryFn<ToolbarStoryArgs> = (args) => {
  const separatorOrientation =
    args.orientation === "vertical" ? "horizontal" : "vertical";

  return (
    <Toolbar aria-label="Text formatting" {...args}>
      {/* Style group */}
      <Group aria-label="Style">
        <ToggleButton aria-label="Bold">
          <b>B</b>
        </ToggleButton>
        <ToggleButton aria-label="Italic">
          <i>I</i>
        </ToggleButton>
        <ToggleButton aria-label="Underline">
          <u>U</u>
        </ToggleButton>
      </Group>

      <Separator orientation={separatorOrientation} />

      {/* Clipboard group */}
      <Group aria-label="Clipboard">
        <Button>Copy</Button>
        <Button>Paste</Button>
        <Button>Cut</Button>
      </Group>

      <Separator orientation={separatorOrientation} />

      {/* Example icon button */}
      <IconButton aria-label="Info">
        <Icon svg={<Icons.Info />} />
      </IconButton>
    </Toolbar>
  );
};

export const Default: Story = {
  render: Template,
  args: {
    orientation: "horizontal",
  },
};

const IconOnlyTemplate: StoryFn<ToolbarStoryArgs> = (args) => {
  const separatorOrientation =
    args.orientation === "vertical" ? "horizontal" : "vertical";
  return (
    <Toolbar aria-label="Tools" {...args}>
      <Group aria-label="Select">
        <Button
          aria-label="Grid"
          leadingVisual={<Icon svg={<Icons.ArchiveOutline />} />}
        />
        <Button
          aria-label="Lasso"
          leadingVisual={<Icon svg={<Icons.AlertTriangleOutline />} />}
        />
        <Button
          aria-label="Edit"
          leadingVisual={<Icon svg={<Icons.EditOutline />} />}
        />
        <Button
          aria-label="Delete"
          leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
        />
      </Group>
      <Separator orientation={separatorOrientation} />
      <Group aria-label="Draw">
        <Button
          aria-label="Settings"
          leadingVisual={<Icon svg={<Icons.SettingsOutline />} />}
        />
        <Button
          aria-label="Info"
          leadingVisual={<Icon svg={<Icons.InfoOutline />} />}
        />
      </Group>
    </Toolbar>
  );
};

export const Vertical: Story = {
  render: IconOnlyTemplate,
  args: {
    orientation: "vertical",
  },
};
