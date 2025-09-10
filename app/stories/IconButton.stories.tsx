import { Meta, StoryFn } from "@storybook/react";
import { css } from "@emotion/react";

import { Button } from "../src/components/button/Button";
import {
  IconButton,
  IconButtonProps,
} from "../src/components/button/IconButton";
import { Icon } from "../src/components/icon/Icon";
import {
  AlertTriangleOutline,
  ArrowRight,
  CloseOutline,
  EditOutline,
  PlusOutline,
  SearchOutline,
  SettingsOutline,
  TrashOutline,
} from "../src/components/icon/Icons";

const meta: Meta = {
  title: "IconButton",
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

const Template: StoryFn<IconButtonProps> = (args) => <IconButton {...args} />;

/**
 * IconButtons are used to perform actions with just an icon
 */
export const Default = Template.bind({});

Default.args = {
  children: <Icon svg={<SearchOutline />} />,
  "aria-label": "Search",
};

/**
 * Different sizes available for IconButton
 */
export const Sizes = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--ac-global-dimension-size-200);
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

/**
 * Various icons in IconButtons
 */
export const DifferentIcons = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--ac-global-dimension-size-200);
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

/**
 * IconButton in disabled state
 */
export const Disabled = Template.bind({});

Disabled.args = {
  children: <Icon svg={<SettingsOutline />} />,
  isDisabled: true,
  "aria-label": "Settings (disabled)",
};

/**
 * IconButton with custom styling
 */
export const CustomStyling = Template.bind({});

CustomStyling.args = {
  children: <Icon svg={<SearchOutline />} />,
  "aria-label": "Custom search",
  css: css`
    --ac-global-text-color-700: var(--ac-global-color-blue-600);
    &[data-hovered] {
      background-color: var(--ac-global-color-blue-100);
      --ac-global-text-color-900: var(--ac-global-color-blue-800);
    }
  `,
};

/**
 * Different sizes with different icons
 */
export const SizeVariations = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--ac-global-dimension-size-300);
    `}
  >
    <div
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ac-global-dimension-size-100);
      `}
    >
      <IconButton size="S" aria-label="Small add">
        <Icon svg={<PlusOutline />} />
      </IconButton>
      <span
        css={css`
          font-size: var(--ac-global-font-size-xs);
          color: var(--ac-global-text-color-500);
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
        gap: var(--ac-global-dimension-size-100);
      `}
    >
      <IconButton size="M" aria-label="Medium edit">
        <Icon svg={<EditOutline />} />
      </IconButton>
      <span
        css={css`
          font-size: var(--ac-global-font-size-xs);
          color: var(--ac-global-text-color-500);
        `}
      >
        Medium
      </span>
    </div>
  </div>
);

/**
 * IconButton with onPress handler
 */
export const Interactive = Template.bind({});

Interactive.args = {
  children: <Icon svg={<SearchOutline />} />,
  "aria-label": "Interactive search",
  onPress: () => alert("IconButton pressed!"),
};

/**
 * IconButtons with different colors using the color prop
 */
export const ButtonColors = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--ac-global-dimension-size-200);
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

/**
 * Comparison of IconButtons with regular Buttons that have leadingVisual icons
 * to verify proper size alignment
 */
export const SizeComparison = () => (
  <div
    css={css`
      display: flex;
      flex-direction: column;
      gap: var(--ac-global-dimension-size-300);
    `}
  >
    {/* Small Size Comparison */}
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: var(--ac-global-dimension-size-200);
      `}
    >
      <span
        css={css`
          font-size: var(--ac-global-font-size-xs);
          color: var(--ac-global-text-color-500);
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
        gap: var(--ac-global-dimension-size-200);
      `}
    >
      <span
        css={css`
          font-size: var(--ac-global-font-size-xs);
          color: var(--ac-global-text-color-500);
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
