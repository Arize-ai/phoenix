import { useNavigate } from "react-router";

import type { TokenProps } from "@phoenix/components";
import { Token } from "@phoenix/components";

import { GradientCircle } from "./GradientCircle";

export interface ProjectTokenProps extends Pick<
  TokenProps,
  "size" | "maxWidth" | "onRemove" | "isDisabled"
> {
  projectId: string;
  name: string;
  gradientStartColor: string;
  gradientEndColor: string;
}

/**
 * A token representing a project, with the project's color gradient as a
 * leading visual so projects can be identified at a glance. Pressing the
 * token navigates to the project's configuration page. When `onRemove` is
 * provided, a remove button is displayed on the token.
 */
export function ProjectToken({
  projectId,
  name,
  gradientStartColor,
  gradientEndColor,
  size = "M",
  maxWidth,
  onRemove,
  isDisabled,
}: ProjectTokenProps) {
  const navigate = useNavigate();
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
      onPress={() => navigate(`/projects/${projectId}/config`)}
      onRemove={onRemove}
      isDisabled={isDisabled}
    >
      {name}
    </Token>
  );
}
