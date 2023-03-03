import React from "react";
import { transparentize } from "polished";
import { css } from "@emotion/react";

type EventItemProps = {
  /**
   * The event's raw textual data (e.g. NLP text)
   */
  rawData: string | null;
};
/**
 * An item that represents a single model event. To be displayed in a grid / list
 */
export function EventItem(props: EventItemProps) {
  const { rawData } = props;
  return (
    <div
      data-testid="event-item"
      css={(theme) => css`
        width: 100%;
        height: 100%;
        border: 1px solid ${theme.colors.gray400};
        border-radius: 4px;
        overflow: hidden;
        transition: background-color 0.2s ease-in-out;

        &:hover {
          background-color: ${transparentize(0.9, theme.colors.arizeLightBlue)};
          border-color: ${transparentize(0.5, theme.colors.arizeLightBlue)};
        }
        &.is-selected {
          border-color: ${theme.colors.arizeLightBlue};
          background-color: ${transparentize(0.8, theme.colors.arizeLightBlue)};
        }
      `}
    >
      {rawData != null ? <p>{rawData}</p> : null}
    </div>
  );
}
