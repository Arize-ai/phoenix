import { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

/**
 * Component that renders a small preview of the plot item
 */
export type ColorPreviewShape = "line" | "circle" | "square";

type ChartTooltipProps = PropsWithChildren<object>;

/**
 * A styled wrapper for chart tooltips
 */
export function ChartTooltip(props: ChartTooltipProps) {
  return (
    <div
      css={css`
        background-color: var(--ac-global-color-grey-200);
        border: 1px solid var(--ac-global-color-grey-300);
        padding: var(--ac-global-dimension-static-size-100);
        border-radius: var(--ac-global-rounding-medium);
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-static-size-50);
        min-width: 200px;
        box-shadow: 0 8px 8px rgba(0, 0, 0, 0.1);
      `}
    >
      {props.children}
    </div>
  );
}

type ChartTooltipItemProps = {
  /**
   * The shape of the color preview
   * @default "line"
   */
  shape?: ColorPreviewShape;
  /**
   * The color of the preview item
   */
  color: string;
  name: string;
  value: string;
};

/**
 * Renders a single item in a chart tooltip
 */
export function ChartTooltipItem(props: ChartTooltipItemProps) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: row;
        justify-content: space-between;
      `}
    >
      <div
        css={css`
          display: flex;
          flex-direction: row;
          gap: var(--ac-global-dimension-static-size-100);
          align-items: center;
        `}
      >
        <PreviewShape color={props.color} shape={props.shape ?? "line"} />
        <Text title={props.name}>
          <Truncate maxWidth="120px">{props.name}</Truncate>
        </Text>
      </div>
      <Text>{props.value}</Text>
    </div>
  );
}

export function ChartTooltipDivider() {
  return (
    <div
      css={css`
        height: 1px;
        background-color: var(--ac-global-color-grey-300);
        width: 100%;
      `}
    />
  );
}

const colorPreviewCSS = (previewShape: ColorPreviewShape) => {
  if (previewShape === "line") {
    return css`
      width: 8px;
      height: 2px;
    `;
  } else if (previewShape === "circle") {
    return css`
      width: 8px;
      height: 8px;
      border-radius: 50%;
    `;
  } else if (previewShape === "square") {
    return css`
      width: 8px;
      height: 8px;
    `;
  }
};

type PreviewShapeProps = {
  /**
   * The color of the shape
   */
  color: string;
  shape?: ColorPreviewShape;
};

/**
 * A small preview of a chart color
 */
function PreviewShape({ color, shape = "line" }: PreviewShapeProps) {
  return (
    <div
      css={css(
        colorPreviewCSS(shape),
        css`
          background-color: ${color};
          flex: none;
        `
      )}
    />
  );
}
