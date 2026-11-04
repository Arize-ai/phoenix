import { Flex, Icon, Icons, Link } from "@phoenix/components";
import { Truncate } from "@phoenix/components/core/utility/Truncate";

export interface DatasetLinkProps {
  name: string;
  /** Where the link goes, such as the dataset or one of its tabs. */
  to: string;
}

/**
 * A link to a dataset, with the dataset icon global search uses and the name
 * truncated to fit, for table cells. Clicks do not reach a clickable row.
 */
export function DatasetLink({ name, to }: DatasetLinkProps) {
  return (
    <Link to={to}>
      <Flex direction="row" gap="size-50" alignItems="center">
        <Icon svg={<Icons.Database />} />
        <Truncate maxWidth="100%">{name}</Truncate>
      </Flex>
    </Link>
  );
}
