import { ChangeEvent } from "react";
import { css } from "@emotion/react";

import { Shape, ShapeIcon } from "./ShapeIcon";

const fieldCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-size-50);
  align-items: center;
`;

type VisibilityCheckboxFieldProps = {
  /**
   * The name of the point group.
   */
  name: string;
  /**
   * The color of the point group.
   * This is used to display a small icon next to the checkbox.
   * @see ShapeIcon
   */
  checked: boolean;
  /**
   * The shape of the icon next to the checkbox.
   * @see ShapeIcon
   * @default Shape.circle
   */
  iconShape?: Shape;
  /**
   * The color of the icon next to the checkbox.
   */
  color: string;
  /**
   * The change callback for the checkbox.
   */
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
};
/**
 * A form field that controls the visibility of a group of points.
 */
export function VisibilityCheckboxField(props: VisibilityCheckboxFieldProps) {
  const { name, checked, onChange, color, iconShape = Shape.circle } = props;

  return (
    <label key={name} css={fieldCSS}>
      <input
        type="checkbox"
        checked={checked}
        name={name}
        onChange={onChange}
      />
      <ShapeIcon shape={iconShape} color={color} />
      {name}
    </label>
  );
}
