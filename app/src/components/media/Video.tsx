import React from "react";
import { css } from "@emotion/react";

interface VideoProps {
  /**
   * URL of the video to play
   */
  src: string;
  /**
   * Width of the video player in pixels
   */
  width?: number;
  /**
   * Height of the video player in pixels
   */
  height?: number;
  /**
   * Whether to show video controls
   */
  controls?: boolean;
  /**
   * Whether to autoplay the video
   */
  autoPlay?: boolean;
  /**
   * Whether to loop the video
   */
  loop?: boolean;
  /**
   * Whether to mute the video
   */
  muted?: boolean;
  /**
   * URL of the poster image to show before video plays
   */
  poster?: string;
  /**
   * CSS class name to apply to video element
   */
  className?: string;
  /**
   * Whether to preload the video
   */
  preload?: "none" | "metadata" | "auto";
}

const videoCSS = css`
  max-width: 100%;
  height: auto;
`;

export const Video: React.FC<VideoProps> = ({
  src,
  width,
  height,
  controls = true,
  autoPlay = false,
  loop = false,
  muted = false,
  poster,
  preload = "none",
  className,
}) => {
  // disable video in CI to prevent bandwidth issues
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  return (
    <video
      css={videoCSS}
      src={src}
      width={width}
      height={height}
      controls={controls}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      poster={poster}
      className={className}
      preload={preload}
    >
      Your browser does not support the video tag.
    </video>
  );
};
