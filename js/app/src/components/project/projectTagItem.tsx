import type { TagGroupLinkItem } from "@phoenix/components";

import { GradientCircle } from "./GradientCircle";

/**
 * A project as a `TagGroup` item: a link to the project's configuration,
 * led by the project's gradient so it can be told apart at a glance.
 */
export function projectTagItem(project: {
  id: string;
  name: string;
  gradientStartColor: string;
  gradientEndColor: string;
}): TagGroupLinkItem {
  return {
    id: project.id,
    label: project.name,
    href: `/projects/${project.id}/config`,
    leadingVisual: (
      <GradientCircle
        gradientStartColor={project.gradientStartColor}
        gradientEndColor={project.gradientEndColor}
        size={12}
      />
    ),
  };
}
