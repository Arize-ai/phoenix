import type { Meta } from "@storybook/react";

import { Checkbox } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Forms/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=268-408",
    },
  },
};

export default meta;

export const Default = {
  args: {
    children: "Checkbox label",
  },
};

export const Checked = {
  args: {
    children: "Checked checkbox",
    isSelected: true,
  },
};

export const Disabled = {
  args: {
    children: "Disabled checkbox",
    isDisabled: true,
  },
};

export const Indeterminate = {
  args: {
    children: "Indeterminate checkbox",
    isIndeterminate: true,
  },
};

export const WithChildren = {
  args: {
    children: (
      <>
        <strong>Bold text</strong> and <em>italic text</em>
      </>
    ),
  },
};

export const NoLabel = {
  args: {
    children: null,
  },
};
