import type { TokenProps } from "@phoenix/components";
import { Token } from "@phoenix/components";

import { GradientCircle } from "./GradientCircle";

export interface ProjectTokenProps extends Pick<
  TokenProps,
  "size" | "maxWidth" | "onPress" | "onRemove" | "isDisabled"
> {
  name: string;
  gradientStartColor: string;
  gradientEndColor: string;
}

/**
 * A token representing a project, with the project's color gradient as a
 * leading visual so projects can be identified at a glance. Purely
 * presentational: to navigate on click, compose it inside a react-router
 * `Link`, or pass `onPress` when the token also has an `onRemove` button
 * (a button cannot nest inside an anchor). When `onRemove` is provided, a
 * remove button is displayed on the token.
 */
export function ProjectToken({
  name,
  gradientStartColor,
  gradientEndColor,
  size = "M",
  maxWidth,
  onPress,
  onRemove,
  isDisabled,
}: ProjectTokenProps) {
  return (
    <Token
      size={size}
      maxWidth={maxWidth}
      color={gradientStartColor}
      leadingVisual={
        <GradientCircle
          gradientStartColor={gradientStartColor}
          gradientEndColor={gradientEndColor}
          size={size === "L" ? 14 : 12}
        />
      }
      title={name}
      onPress={onPress}
      onRemove={onRemove}
      isDisabled={isDisabled}
    >
      {name}
    </Token>
  );
}
