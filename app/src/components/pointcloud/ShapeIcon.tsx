import { useMemo } from "react";
import { css } from "@emotion/react";

import { assertUnreachable } from "@phoenix/typeUtils";

export enum Shape {
  square = "square",
  circle = "circle",
  diamond = "diamond",
}

type ShapeIconProps = {
  /**
   * The shape of the icon / symbol
   */
  shape: Shape;
  /**
   * The color of the icon / symbol
   */
  color: string;
};

const SquareSVG = () => (
  <svg
    width="12px"
    height="12px"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="12" height="12" rx="1" fill="currentColor" />
  </svg>
);

const CircleSVG = () => {
  return (
    <svg
      width="12px"
      height="12px"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="6" cy="6" r="6" fill="currentColor" />
    </svg>
  );
};

const DiamondSVG = () => {
  return (
    <svg
      width="12px"
      height="12px"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 0L12 6L6 12L0 6L6 0Z" fill="currentColor" />
    </svg>
  );
};

export function ShapeIcon(props: ShapeIconProps) {
  const { shape, color } = props;
  const shapeSVG = useMemo(() => {
    switch (shape) {
      case Shape.square:
        return <SquareSVG />;
      case Shape.circle:
        return <CircleSVG />;
      case Shape.diamond:
        return <DiamondSVG />;
      default:
        assertUnreachable(shape);
    }
  }, [shape]);

  return (
    <i
      className="shape-icon"
      style={{ color }}
      css={css`
        display: flex;
        flex-direction: row;
        align-items: center;
      `}
      aria-hidden={true}
    >
      {shapeSVG}
    </i>
  );
}
