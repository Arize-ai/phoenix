import type { Meta, StoryObj } from "@storybook/react";

import {
  Button,
  DialogTrigger,
  Icon,
  Icons,
  Popover,
} from "@phoenix/components";
import { ProjectSelectionMenu } from "@phoenix/components/project";

const PROJECTS = [
  {
    id: "1",
    name: "default",
    gradientStartColor: "#5bdbff",
    gradientEndColor: "#1c76fd",
  },
  {
    id: "2",
    name: "chatbot-production",
    gradientStartColor: "#ff8a00",
    gradientEndColor: "#e52e71",
  },
  {
    id: "3",
    name: "rag-experiments",
    gradientStartColor: "#00c853",
    gradientEndColor: "#00bfa5",
  },
  {
    id: "4",
    name: "a-project-with-an-exceptionally-long-name-that-should-truncate",
    gradientStartColor: "#aa00ff",
    gradientEndColor: "#6200ea",
  },
];

const meta: Meta<typeof ProjectSelectionMenu> = {
  title: "Project/ProjectSelectionMenu",
  component: ProjectSelectionMenu,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    onProjectSelect: { action: "projectSelected" },
  },
};

export default meta;

type Story = StoryObj<typeof ProjectSelectionMenu>;

export const Default: Story = {
  args: {
    projects: PROJECTS,
  },
};

export const WithDisabledProject: Story = {
  args: {
    projects: PROJECTS,
    disabledProjectIds: ["1"],
  },
};

export const Empty: Story = {
  args: {
    projects: [],
    emptyDescription: "All projects already use this policy",
  },
};

/**
 * The menu is designed to fill a popover: the search field pins to the top
 * and the project list scrolls beneath it.
 */
export const InPopover: Story = {
  render: (args) => (
    <DialogTrigger>
      <Button size="S" leadingVisual={<Icon svg={<Icons.Plus />} />}>
        Add project
      </Button>
      <Popover placement="bottom end">
        <ProjectSelectionMenu {...args} />
      </Popover>
    </DialogTrigger>
  ),
  args: {
    projects: PROJECTS,
  },
};
