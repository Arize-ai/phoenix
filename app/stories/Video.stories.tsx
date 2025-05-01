import type { Meta, StoryObj } from "@storybook/react";

import { Video } from "../src/components/media";

const meta: Meta<typeof Video> = {
  title: "Media/Video",
  component: Video,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    src: { control: "text" },
    width: { control: "number" },
    height: { control: "number" },
    controls: { control: "boolean" },
    autoPlay: { control: "boolean" },
    loop: { control: "boolean" },
    muted: { control: "boolean" },
    poster: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Video>;

// Example video from Pixabay (Creative Commons License)
const EXAMPLE_VIDEO =
  "https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/experiments.mp4";

export const Default: Story = {
  args: {
    src: EXAMPLE_VIDEO,
    width: 640,
    height: 360,
  },
};

export const WithPoster: Story = {
  args: {
    ...Default.args,
  },
};

export const AutoplayMuted: Story = {
  args: {
    ...Default.args,
    autoPlay: true,
    muted: true, // Required for autoplay in most browsers
    loop: true,
  },
};

export const NoControls: Story = {
  args: {
    ...Default.args,
    controls: false,
  },
};

export const Responsive: Story = {
  args: {
    src: EXAMPLE_VIDEO,
    // No width/height to demonstrate responsive behavior
  },
};

export const CustomSize: Story = {
  args: {
    ...Default.args,
    width: 320,
    height: 180,
  },
};
