import { Checkbox } from "@phoenix/components/checkbox";

import { Shape, ShapeIcon } from "./ShapeIcon";

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
  onChange?: (isSelected: boolean) => void;
};
/**
 * A form field that controls the visibility of a group of points.
 */
export function VisibilityCheckboxField(props: VisibilityCheckboxFieldProps) {
  const { name, checked, onChange, color, iconShape = Shape.circle } = props;

  return (
    <Checkbox isSelected={checked} name={name} onChange={onChange} key={name}>
      <ShapeIcon shape={iconShape} color={color} />
      {name}
    </Checkbox>
  );
}
