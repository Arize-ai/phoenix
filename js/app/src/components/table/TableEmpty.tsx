import { Text } from "@phoenix/components";

import { TableEmptyWrap } from "./TableEmptyWrap";

export function TableEmpty(props: { message?: string }) {
  const { message = "No Data" } = props;
  return (
    <TableEmptyWrap>
      <Text>{message}</Text>
    </TableEmptyWrap>
  );
}
