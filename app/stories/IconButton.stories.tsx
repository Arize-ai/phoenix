import { css } from "@emotion/react";
import type { Meta } from "@storybook/react";

import { Button } from "../src/components/core/button/Button";
import { IconButton } from "../src/components/core/button/IconButton";
import { Icon } from "../src/components/core/icon/Icon";
import {
  AlertTriangleOutline,
  ArrowRight,
  CloseOutline,
  EditOutline,
  PlusOutline,
  SearchOutline,
  SettingsOutline,
  TrashOutline,
} from "../src/components/core/icon/Icons";

const meta: Meta = {
  title: "Core/Actions/Icon Button",
  component: IconButton,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=66-247",
    },
  },
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["S", "M"],
    },
    color: {
      control: { type: "select" },
      options: [
        "text-300",
        "text-500",
        "text-700",
        "text-900",
        "blue-600",
        "red-600",
        "green-600",
        "orange-600",
        "inherit",
      ],
    },
    isDisabled: {
      control: { type: "boolean" },
    },
  },
};

export default meta;

export const Default = {
  args: {
    children: <Icon svg={<SearchOutline />} />,
    "aria-label": "Search",
  },
};

export const Sizes = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--global-dimension-size-200);
    `}
  >
    <IconButton size="S" aria-label="Small search">
      <Icon svg={<SearchOutline />} />
    </IconButton>
    <IconButton size="M" aria-label="Medium search">
      <Icon svg={<SearchOutline />} />
    </IconButton>
  </div>
);

export const DifferentIcons = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--global-dimension-size-200);
      flex-wrap: wrap;
    `}
  >
    <IconButton aria-label="Search">
      <Icon svg={<SearchOutline />} />
    </IconButton>
    <IconButton aria-label="Settings">
      <Icon svg={<SettingsOutline />} />
    </IconButton>
    <IconButton aria-label="Delete">
      <Icon svg={<TrashOutline />} />
    </IconButton>
    <IconButton aria-label="Edit">
      <Icon svg={<EditOutline />} />
    </IconButton>
    <IconButton aria-label="Add">
      <Icon svg={<PlusOutline />} />
    </IconButton>
    <IconButton aria-label="Close">
      <Icon svg={<CloseOutline />} />
    </IconButton>
    <IconButton aria-label="Next">
      <Icon svg={<ArrowRight />} />
    </IconButton>
  </div>
);

export const Disabled = {
  args: {
    children: <Icon svg={<SettingsOutline />} />,
    isDisabled: true,
    "aria-label": "Settings (disabled)",
  },
};

export const CustomStyling = {
  args: {
    children: <Icon svg={<SearchOutline />} />,
    "aria-label": "Custom search",
    css: css`
      --global-text-color-700: var(--global-color-blue-600);
      &[data-hovered] {
        background-color: var(--global-color-blue-100);
        --global-text-color-900: var(--global-color-blue-800);
      }
    `,
  },
};

export const SizeVariations = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--global-dimension-size-300);
    `}
  >
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <IconButton size="S" aria-label="Small add">
        <Icon svg={<PlusOutline />} />
      </IconButton>
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
        `}
      >
        Small
      </span>
    </div>
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <IconButton size="M" aria-label="Medium edit">
        <Icon svg={<EditOutline />} />
      </IconButton>
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
        `}
      >
        Medium
      </span>
    </div>
  </div>
);

export const Interactive = {
  args: {
    children: <Icon svg={<SearchOutline />} />,
    "aria-label": "Interactive search",
    onPress: () => alert("IconButton pressed!"),
  },
};

export const ButtonColors = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--global-dimension-size-200);
      flex-wrap: wrap;
    `}
  >
    <IconButton aria-label="Default color">
      <Icon svg={<SearchOutline />} />
    </IconButton>
    <IconButton color="text-500" aria-label="Muted search">
      <Icon svg={<SearchOutline />} />
    </IconButton>
    <IconButton color="blue-600" aria-label="Blue search">
      <Icon svg={<SearchOutline />} />
    </IconButton>
    <IconButton color="red-600" aria-label="Red delete">
      <Icon svg={<TrashOutline />} />
    </IconButton>
    <IconButton color="green-600" aria-label="Green success">
      <Icon svg={<PlusOutline />} />
    </IconButton>
    <IconButton color="orange-600" aria-label="Orange warning">
      <Icon svg={<AlertTriangleOutline />} />
    </IconButton>
  </div>
);

export const SizeComparison = () => (
  <div
    css={css`
      display: flex;
      flex-direction: column;
      gap: var(--global-dimension-size-300);
    `}
  >
    {/* Small Size Comparison */}
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: var(--global-dimension-size-200);
      `}
    >
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
          width: 60px;
        `}
      >
        Small:
      </span>
      <IconButton size="S" aria-label="Small icon button">
        <Icon svg={<SearchOutline />} />
      </IconButton>
      <Button size="S" leadingVisual={<Icon svg={<SearchOutline />} />}>
        Button
      </Button>
    </div>

    {/* Medium Size Comparison */}
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: var(--global-dimension-size-200);
      `}
    >
      <span
        css={css`
          font-size: var(--global-font-size-xs);
          color: var(--global-text-color-500);
          width: 60px;
        `}
      >
        Medium:
      </span>
      <IconButton size="M" aria-label="Medium icon button">
        <Icon svg={<EditOutline />} />
      </IconButton>
      <Button size="M" leadingVisual={<Icon svg={<EditOutline />} />}>
        Button
      </Button>
    </div>
  </div>
);
