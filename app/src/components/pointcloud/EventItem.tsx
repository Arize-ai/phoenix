import React from "react";
import { transparentize } from "polished";
import { css } from "@emotion/react";

import { DatasetType } from "@phoenix/types";

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
  datasetType: DatasetType;
  /**
   * event handler for when the user clicks on the event item
   */
  onClick: () => void;
  /**
   * The color accent for the event. Corresponds to the color of the group the event belongs to
   */
  color: string;
};
/**
 * An item that represents a single model event. To be displayed in a grid / list
 */
export function EventItem(props: EventItemProps) {
  const { rawData, linkToData, onClick, color } = props;
  // Prioritize the image preview over raw text
  const previewType: "raw" | "image" = linkToData != null ? "image" : "raw";
  return (
    <div
      data-testid="event-item"
      role="button"
      css={(theme) => css`
        width: 100%;
        height: 100%;
        border: 1px solid ${theme.colors.gray400};
        border-radius: 4px;
        overflow: hidden;
        transition: background-color 0.2s ease-in-out;
        display: flex;
        flex-direction: column;
        cursor: pointer;
        &:hover {
          background-color: ${transparentize(0.9, theme.colors.arizeLightBlue)};
          border-color: ${transparentize(0.5, theme.colors.arizeLightBlue)};
        }
        &.is-selected {
          border-color: ${theme.colors.arizeLightBlue};
          background-color: ${transparentize(0.8, theme.colors.arizeLightBlue)};
        }
      `}
      onClick={onClick}
    >
      {previewType === "image" ? (
        <img
          src={linkToData as string}
          css={css`
            flex: 1 1 auto;
            min-height: 0;
            // Maintain aspect ratio while having normalized height
            object-fit: contain;
          `}
        />
      ) : (
        <p
          css={css`
            flex: 1 1 auto;
            padding: var(--px-spacing-med);
            margin-block-start: 0;
            margin-block-end: 0;
          `}
        >
          {rawData}
        </p>
      )}
      <div
        data-testid="event-association"
        data-dataset-type={props.datasetType}
        css={css`
          height: var(--px-gradient-bar-height);
          flex: none;
          background-color: ${color};
          transition: background-color 0.5s ease-in-out;
        `}
      />
    </div>
  );
}
