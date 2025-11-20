import { css } from "@emotion/react";

import {
  Button,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";

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

export function MessageRoleSelect({
  role,
  includeLabel = true,
  onChange,
}: MessageRolePickerProps) {
  return (
    <Select
      value={role}
      css={!includeLabel ? hiddenLabelCSS : undefined}
      data-testid="messages-role-picker"
      aria-label="Role for the chat message"
      size="S"
      onChange={(e) => {
        if (!isChatMessageRole(e)) {
          throw new Error(`Invalid chat message role: ${e}`);
        }
        onChange(e);
      }}
    >
      {includeLabel && <Label>Role</Label>}
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover
        placement="bottom start"
        offset={4}
        shouldFlip={true}
        containerPadding={8}
      >
        <ListBox>
          <SelectItem id="system">System</SelectItem>
          <SelectItem id="user">User</SelectItem>
          <SelectItem id="ai">AI</SelectItem>
          <SelectItem id="tool">Tool</SelectItem>
        </ListBox>
      </Popover>
    </Select>
  );
}
