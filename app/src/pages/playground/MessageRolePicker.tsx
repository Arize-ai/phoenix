import { css } from "@emotion/react";

import { Item, Picker } from "@arizeai/components";

import { isChatMessageRole } from "./playgroundUtils";

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
  /**
   * Callback for when the message role changes
   */
  onChange: (role: ChatMessageRole) => void;
};

export function MessageRolePicker({
  role,
  includeLabel = true,
  onChange,
}: MessageRolePickerProps) {
  return (
    <Picker
      selectedKey={role}
      css={!includeLabel ? hiddenLabelCSS : undefined}
      label="Role"
      data-testid="messages-role-picker"
      aria-label={`Role for the chat message`}
      size="compact"
      onSelectionChange={(e) => {
        if (!isChatMessageRole(e)) {
          throw new Error(`Invalid chat message role: ${e}`);
        }
        onChange(e);
      }}
    >
      <Item key="system">System</Item>
      <Item key="user">User</Item>
      <Item key="ai">AI</Item>
      <Item key="tool">Tool</Item>
    </Picker>
  );
}
