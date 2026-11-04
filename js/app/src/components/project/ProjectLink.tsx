import { Flex, Icon, Icons, Link } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";

export interface ProjectLinkProps {
  name: string;
  /** Where the link goes, such as the project or one of its tabs. */
  to: string;
}

/**
 * A link to a project, with the project icon global search uses and the name
 * truncated to fit, for table cells. Clicks do not reach a clickable row.
 */
export function ProjectLink({ name, to }: ProjectLinkProps) {
  return (
    <Link to={to}>
      <Flex direction="row" gap="size-50" alignItems="center">
        <Icon svg={<Icons.Trace />} />
        <Truncate maxWidth="100%">{name}</Truncate>
      </Flex>
    </Link>
  );
}
