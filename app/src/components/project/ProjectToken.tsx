import { useNavigate } from "react-router";

import type { TokenProps } from "@phoenix/components";
import { Token } from "@phoenix/components";

import { GradientCircle } from "./GradientCircle";

export interface ProjectTokenProps extends Pick<
  TokenProps,
  "size" | "maxWidth"
> {
  projectId: string;
  name: string;
  gradientStartColor: string;
  gradientEndColor: string;
}

/**
 * A token representing a project, with the project's color gradient as a
 * leading visual so projects can be identified at a glance. Pressing the
 * token navigates to the project's configuration page.
 */
export function ProjectToken({
  projectId,
  name,
  gradientStartColor,
  gradientEndColor,
  size = "M",
  maxWidth,
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
          size={12}
        />
      }
      title={name}
      onPress={() => navigate(`/projects/${projectId}/config`)}
    >
      {name}
    </Token>
  );
}
