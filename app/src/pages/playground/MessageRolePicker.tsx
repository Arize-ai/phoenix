import React from "react";
import { css } from "@emotion/react";

import { Item, Picker } from "@arizeai/components";

import { ChatMessageRole } from "@phoenix/store";

const hiddenLabelCSS = css`
  .ac-field-label {
    display: none;
  }
`;

type MessageRolePickerProps = {
  /**
   * The currently selected message role
   */
  role: ChatMessageRole;
  /**
   * Whether to display a label for the picker
   * This may be set to false in cases where the picker is rendered in a table for instance
   * @default true
   */
  includeLabel?: boolean;
};

export function MessageRolePicker({
  role,
  includeLabel = true,
}: MessageRolePickerProps) {
  return (
    <Picker
      selectedKey={role}
      css={!includeLabel ? hiddenLabelCSS : undefined}
      label="Role"
      data-testid="inferences-time-range"
      aria-label={`Time range for the primary inferences`}
      size="compact"
      onSelectionChange={() => {
        // TODO: fill out
      }}
    >
      <Item key="system">System</Item>
      <Item key="user">User</Item>
      <Item key="ai">AI</Item>
    </Picker>
  );
}
