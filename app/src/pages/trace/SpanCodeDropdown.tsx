import React from "react";
import { css } from "@emotion/react";

import {
  DropdownButton,
  DropdownMenu,
  DropdownTrigger,
  Form,
  TextField,
} from "@arizeai/components";

import {
  CopyToClipboardButton,
  Flex,
  Icon,
  Icons,
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
            <Form>
              <Flex direction="row" gap="size-100" alignItems="end">
                <TextField label="Span ID" isReadOnly value={spanId} />
                <CopyToClipboardButton text={spanId} size="M" />
              </Flex>
              <Flex direction="row" gap="size-100" alignItems="end">
                <TextField label="Trace ID" isReadOnly value={traceId} />
                <CopyToClipboardButton text={traceId} size="M" />
              </Flex>
            </Form>
          </View>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
