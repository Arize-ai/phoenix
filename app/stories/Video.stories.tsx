import type { Meta, StoryObj } from "@storybook/react";

import { Video } from "../src/components/media";

/**
 * The Video component is a wrapper around the HTML5 video element that provides a simple,
 * responsive interface for embedding videos in your application.
 *
 * ## Usage
 *
 * ```tsx
 * // Basic usage
 * <Video src="https://example.com/video.mp4" />
 *
 * // With additional options
 * <Video
 *   src="https://example.com/video.mp4"
 *   width={720}
 *   height={480}
 *   autoPlay
 *   muted
 *   poster="https://example.com/thumbnail.jpg"
 * />
 * ```
 *
 * ## Features
 * - Responsive by default
 * - TypeScript support
 * - Customizable controls
 * - Autoplay support (requires muted for most browsers)
 * - Poster image support
 */
const meta: Meta<typeof Video> = {
  title: "Media/Video",
  component: Video,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A React component that wraps the HTML5 video element with a clean, simple API.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    src: {
      control: "text",
      description: "URL of the video file to play",
      table: {
        type: { summary: "string" },
      },
    },
    width: {
      control: "number",
      description: "Width of the video player in pixels",
      table: {
        type: { summary: "number" },
        defaultValue: { summary: "undefined (responsive)" },
      },
    },
    height: {
      control: "number",
      description: "Height of the video player in pixels",
      table: {
        type: { summary: "number" },
        defaultValue: { summary: "undefined (responsive)" },
      },
    },
    controls: {
      control: "boolean",
      description: "Whether to show the video player controls",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    autoPlay: {
      control: "boolean",
      description:
        "Whether to automatically start playing the video (requires muted in most browsers)",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    loop: {
      control: "boolean",
      description: "Whether to loop the video playback",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    muted: {
      control: "boolean",
      description: "Whether to mute the video (required for autoplay)",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    poster: {
      control: "text",
      description: "URL of the image to show before video playback begins",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "undefined" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Video>;

// Example video from Pixabay (Creative Commons License)
const EXAMPLE_VIDEO =
  "https://storage.googleapis.com/arize-phoenix-assets/assets/gifs/experiments.mp4";

/**
 * The default story shows a basic video player with standard dimensions and controls.
 * This is the most common use case for the Video component.
 */
export const Default: Story = {
  args: {
    src: EXAMPLE_VIDEO,
    width: 640,
    height: 360,
  },
};

/**
 * This story demonstrates autoplay functionality. Note that browsers require the video
 * to be muted for autoplay to work. The video is also set to loop for continuous playback.
 */
export const AutoplayMuted: Story = {
  args: {
    ...Default.args,
    autoPlay: true,
    muted: true, // Required for autoplay in most browsers
    loop: true,
  },
};

/**
 * This story shows how the video appears without player controls.
 * Useful for background videos or when implementing custom controls.
 */
export const NoControls: Story = {
  args: {
    ...Default.args,
    controls: false,
  },
};

/**
 * This story demonstrates the responsive behavior of the video player.
 * When no width or height is specified, the video will scale to fit its container
 * while maintaining aspect ratio.
 */
export const Responsive: Story = {
  args: {
    src: EXAMPLE_VIDEO,
    // No width/height to demonstrate responsive behavior
  },
};

/**
 * This story shows the video at a smaller size, demonstrating how the player
 * maintains quality and usability at different dimensions.
 */
export const CustomSize: Story = {
  args: {
    ...Default.args,
    width: 320,
    height: 180,
  },
};
