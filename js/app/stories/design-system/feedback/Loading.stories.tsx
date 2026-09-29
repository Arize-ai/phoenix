import type { Meta, StoryFn } from "@storybook/react";

import { Loading } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * An indeterminate spinner centered in the space it fills, for a panel,
 * dialog or menu whose content has not loaded yet. It is the usual `Suspense`
 * fallback. Use `S` inside compact surfaces such as a menu or a button's
 * popover. Where the shape of the coming content is known, a `Skeleton`
 * keeps the layout from moving when it arrives.
 */
const meta: Meta = {
  title: "Design System/Feedback/Loading",
  component: Loading,
  tags: ["updated", "unreviewed", "complete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=532-1769",
    },
  },
};

export default meta;

const SIZES: { label: "S" | "M"; code: true }[] = [
  { label: "S", code: true },
  { label: "M", code: true },
];

const MESSAGES: { label: string; message?: string }[] = [
  { label: "No message" },
  { label: "Empty", message: "" },
  { label: "1 character", message: "…" },
  { label: "Regular", message: "Loading data..." },
  {
    label: "Long",
    message: "Loading the latest spans for this project and its sessions",
  },
];

export const Default: StoryFn = () => <Loading />;
Default.tags = ["!dev"];

export const MessagesAndSizes: StoryFn = () => (
  <OptionGrid
    rows={MESSAGES}
    columns={SIZES}
    cellWidth="200px"
    justifyCells="center"
    renderCell={(message, size) => (
      <Loading message={message.message} size={size?.label} />
    )}
  />
);
MessagesAndSizes.tags = ["!dev"];
MessagesAndSizes.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryFn = () => <Loading message="Loading data..." />;
Thumbnail.tags = ["!dev", "!autodocs"];
