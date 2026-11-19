import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Button } from "@phoenix/components/core/button/Button";
import { IconButton } from "@phoenix/components/core/button/IconButton";
import { Icon } from "@phoenix/components/core/icon/Icon";
import {
  AlertTriangle,
  ChevronRight,
  Close,
  Duplicate,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash,
} from "@phoenix/components/core/icon/Icons";

const meta: Meta = {
  title: "Design System/Actions/Icon Button",
  tags: ["updated", "unreviewed", "incomplete"],
  component: IconButton,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=66-247",
    },
    controls: { disable: true },
  },
};

export default meta;

export const Sizes = () => (
  <div
    css={css`
      display: flex;
      align-items: end;
      gap: var(--global-dimension-size-300);
    `}
  >
    {(["XS", "S", "M"] as const).map((size) => (
      <div
        key={size}
        css={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--global-dimension-size-100);
        `}
      >
        <IconButton size={size} aria-label="Copy">
          <Icon svg={<Duplicate />} />
        </IconButton>
        <span
          css={css`
            font-size: var(--global-font-size-xs);
            color: var(--global-text-color-500);
          `}
        >
          {size}
        </span>
      </div>
    ))}
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
      <Icon svg={<Search />} />
    </IconButton>
    <IconButton aria-label="Settings">
      <Icon svg={<Settings />} />
    </IconButton>
    <IconButton aria-label="Delete">
      <Icon svg={<Trash />} />
    </IconButton>
    <IconButton aria-label="Edit">
      <Icon svg={<Edit />} />
    </IconButton>
    <IconButton aria-label="Add">
      <Icon svg={<Plus />} />
    </IconButton>
    <IconButton aria-label="Close">
      <Icon svg={<Close />} />
    </IconButton>
    <IconButton aria-label="Next">
      <Icon svg={<ChevronRight />} />
    </IconButton>
    <IconButton aria-label="More actions">
      <Icon svg={<MoreHorizontal />} />
    </IconButton>
  </div>
);

/**
 * Pressable and disabled. Presses are logged in the Actions panel; the
 * disabled button ignores them.
 */
export const Interactive = () => (
  <div
    css={css`
      display: flex;
      align-items: center;
      gap: var(--global-dimension-size-200);
    `}
  >
    <IconButton aria-label="Settings" onPress={fn()}>
      <Icon svg={<Settings />} />
    </IconButton>
    <IconButton aria-label="Settings" isDisabled onPress={fn()}>
      <Icon svg={<Settings />} />
    </IconButton>
  </div>
);

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
      <Icon svg={<Search />} />
    </IconButton>
    <IconButton color="text-500" aria-label="Muted search">
      <Icon svg={<Search />} />
    </IconButton>
    <IconButton color="blue-600" aria-label="Blue search">
      <Icon svg={<Search />} />
    </IconButton>
    <IconButton color="red-600" aria-label="Red delete">
      <Icon svg={<Trash />} />
    </IconButton>
    <IconButton color="green-600" aria-label="Green success">
      <Icon svg={<Plus />} />
    </IconButton>
    <IconButton color="orange-600" aria-label="Orange warning">
      <Icon svg={<AlertTriangle />} />
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
        <Icon svg={<Search />} />
      </IconButton>
      <Button size="S" leadingVisual={<Icon svg={<Search />} />}>
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
        <Icon svg={<Edit />} />
      </IconButton>
      <Button size="M" leadingVisual={<Icon svg={<Edit />} />}>
        Button
      </Button>
    </div>
  </div>
);

Sizes.tags = ["!dev"];
DifferentIcons.tags = ["!dev"];
Interactive.tags = ["!dev"];
ButtonColors.tags = ["!dev"];
SizeComparison.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: var(--global-dimension-size-100);
      `}
    >
      <IconButton aria-label="Search">
        <Icon svg={<Search />} />
      </IconButton>
      <IconButton aria-label="Settings">
        <Icon svg={<Settings />} />
      </IconButton>
      <IconButton aria-label="Edit">
        <Icon svg={<Edit />} />
      </IconButton>
      <IconButton aria-label="Delete">
        <Icon svg={<Trash />} />
      </IconButton>
    </div>
  ),
};
