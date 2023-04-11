import React, { PropsWithChildren, ReactNode } from "react";
import { transparentize } from "polished";
import { css } from "@emotion/react";

import { DatasetRole } from "@phoenix/types";

type EventItemProps = {
  /**
   * The event's raw textual data (e.g. NLP text)
   */
  rawData: string | null;
  /**
   * The event's URL to the data (e.x. CV image)
   */
  linkToData: string | null;
  /**
   * Which dataset the event belongs to
   */
  datasetRole: DatasetRole;
  /**
   * event handler for when the user clicks on the event item
   */
  onClick: () => void;
  /**
   * The color accent for the event. Corresponds to the color of the group the event belongs to
   */
  color: string;
  /**
   * The size of the event item
   */
  size: "small" | "medium" | "large";
};
/**
 * An item that represents a single model event. To be displayed in a grid / list
 */
export function EventItem(props: EventItemProps) {
  const { rawData, linkToData, onClick, color, size } = props;
  // Prioritize the image preview over raw text
  const previewType: "raw" | "image" = linkToData != null ? "image" : "raw";

  let secondaryPreview: ReactNode | null = null;
  let footer: ReactNode | null = null;
  if (size !== "small") {
    // Only show secondary previews for medium and large sizes
    switch (previewType) {
      case "image": {
        if (rawData != null) {
          secondaryPreview = (
            <RawTextPreview size={size}>{rawData}</RawTextPreview>
          );
        } else {
          secondaryPreview = null;
        }
        break;
      }
    }
    footer = <EventItemFooter datasetRole={DatasetRole} />;
  }

  return (
    <div
      data-testid="event-item"
      role="button"
      data-size={size}
      css={(theme) => css`
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        border-style: solid;
        border-radius: 4px;
        overflow: hidden;

        display: flex;
        flex-direction: column;
        cursor: pointer;
        overflow: hidden;

        border-width: 2px;
        border-color: ${color};
        border-radius: 8px;
        &:hover {
          background-color: ${transparentize(0.9, theme.colors.arizeLightBlue)};
        }
      `}
      onClick={onClick}
    >
      <div
        className="event-item__preview-wrap"
        css={css`
          display: flex;
          flex-direction: row;
          flex: 1 1 auto;
          overflow: hidden;
        `}
      >
        {previewType === "image" ? (
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          <ImagePreview linkToData={linkToData!} />
        ) : (
          <RawTextPreview size={size}>{rawData}</RawTextPreview>
        )}
        {secondaryPreview}
      </div>
      {footer}
    </div>
  );
}

function ImagePreview(props: { linkToData: string }) {
  return (
    <img
      src={props.linkToData}
      css={css`
        width: 100%;
        height: 100%;
        min-height: 0;
        // Maintain aspect ratio while having normalized height
        object-fit: contain;
      `}
    />
  );
}
function RawTextPreview(
  props: PropsWithChildren<{
    size: "small" | "medium" | "large";
  }>
) {
  return (
    <p
      data-size={props.size}
      css={(theme) => css`
        flex: 1 1 auto;
        padding: var(--px-spacing-med);
        margin-block-start: 0;
        margin-block-end: 0;
        position: relative;

        &[data-size="small"] {
          padding: var(--px-spacing-sm);
          font-size: ${theme.typography.sizes.small.fontSize}px;
          box-sizing: border-box;
        }

        &[data-size="large"] {
        }
        &:before {
          content: "";
          width: 100%;
          height: 100%;
          position: absolute;
          left: 0;
          top: 0;
          background: linear-gradient(
            transparent 85%,
            var(--px-item-background-color) 98%
          );
        }
      `}
    >
      {props.children}
    </p>
  );
}
