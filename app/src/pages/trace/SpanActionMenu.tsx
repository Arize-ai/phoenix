import copy from "copy-to-clipboard";

import { ActionMenu, Item } from "@arizeai/components";

import { Flex, Icon, Icons, Text } from "@phoenix/components";
import { useNotifySuccess } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";

type SpanActionMenuProps = {
  spanId: string;
  traceId: string;
};

enum SpanAction {
  COPY_SPAN_ID = "COPY_SPAN_ID",
  COPY_TRACE_ID = "COPY_TRACE_ID",
}
/**
 * A Dropdown that displays how to code against a span or trace
 */
export function SpanActionMenu(props: SpanActionMenuProps) {
  const { spanId, traceId } = props;
  const notifySuccess = useNotifySuccess();

  return (
    <ActionMenu
      buttonSize="compact"
      align="end"
      onAction={(firedAction) => {
        const action = firedAction as SpanAction;
        switch (action) {
          case SpanAction.COPY_SPAN_ID: {
            copy(spanId);
            notifySuccess({
              title: "Span ID Copied",
              message: `The Span ID ${spanId} has been copied to your clipboard`,
            });
            return;
          }
          case SpanAction.COPY_TRACE_ID: {
            copy(traceId);
            notifySuccess({
              title: "Trace ID Copied",
              message: `The Trace ID ${traceId} has been copied to your clipboard`,
            });
            return;
          }
          default: {
            assertUnreachable(action);
          }
        }
      }}
    >
      <Item key={SpanAction.COPY_SPAN_ID}>
        <Flex
          direction="row"
          gap="size-75"
          justifyContent="start"
          alignItems="center"
        >
          <Icon svg={<Icons.ClipboardCopy />} />
          <Text>Copy Span ID</Text>
        </Flex>
      </Item>
      <Item key={SpanAction.COPY_TRACE_ID}>
        <Flex
          direction="row"
          gap="size-75"
          justifyContent="start"
          alignItems="center"
        >
          <Icon svg={<Icons.ClipboardCopy />} />
          <Text>Copy Trace ID</Text>
        </Flex>
      </Item>
    </ActionMenu>
  );
}
