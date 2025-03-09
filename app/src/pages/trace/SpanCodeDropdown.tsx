import React from "react";
import { css } from "@emotion/react";

import {
  DropdownButton,
  DropdownMenu,
  DropdownTrigger,
} from "@arizeai/components";

import {
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  TextField,
  View,
} from "@phoenix/components";

type SpanCodeDropdownProps = {
  spanId: string;
  traceId: string;
};
/**
 * A Dropdown that displays how to code against a span or trace
 */
export function SpanCodeDropdown(props: SpanCodeDropdownProps) {
  const { spanId, traceId } = props;

  return (
    <div
      css={css`
        button.ac-dropdown-button {
          min-width: 50px;
          .ac-dropdown-button__text {
            padding-right: 10px;
          }
        }
      `}
    >
      <DropdownTrigger placement="bottom right">
        <DropdownButton addonBefore={<Icon svg={<Icons.Code />} />}>
          Code
        </DropdownButton>
        <DropdownMenu>
          <View padding="size-200">
            <Flex direction="column" gap="size-100">
              <Flex direction="row" gap="size-100" alignItems="end">
                <TextField value={spanId} isReadOnly size="M">
                  <Label>Span ID</Label>
                  <Input />
                </TextField>
                <CopyToClipboardButton text={spanId} size="M" />
              </Flex>
              <Flex direction="row" gap="size-100" alignItems="end">
                <TextField value={traceId} isReadOnly size="M">
                  <Label>Trace ID</Label>
                  <Input />
                </TextField>
                <CopyToClipboardButton text={traceId} size="M" />
              </Flex>
            </Flex>
          </View>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
