import { css } from "@emotion/react";

import {
  Button,
  FieldError,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectProps,
  SelectValue,
} from "@phoenix/components";
import { isUserRole, normalizeUserRole, UserRole } from "@phoenix/constants";

const UserRoles = Object.values(UserRole);

const hiddenLabelCSS = css`
  .ac-field-label {
    display: none;
  }
`;

type RoleSelectProps = {
  onChange: (role: UserRole) => void;
  role?: UserRole;
  /**
   * Whether to display a label for the select
   * This may be set to false in cases where the select is rendered in a table for instance
   * @default true
   */
  includeLabel?: boolean;
  /**
   * Error message to display below the select
   */
  errorMessage?: string;
} & Omit<SelectProps, "children" | "onSelectionChange" | "selectedKey">;

export function RoleSelect({
  onChange,
  role,
  includeLabel = true,
  errorMessage,
  ...selectProps
}: RoleSelectProps) {
  return (
    <Select
      css={!includeLabel ? hiddenLabelCSS : undefined}
      className="role-select"
      selectedKey={role ?? undefined}
      aria-label="User Role"
      isInvalid={!!errorMessage}
      onSelectionChange={(key) => {
        if (isUserRole(key)) {
          onChange(key);
        }
      }}
      {...selectProps}
    >
      {includeLabel && <Label>Role</Label>}
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {UserRoles.map((role) => {
            return (
              <SelectItem key={role} id={role}>
                {normalizeUserRole(role)}
              </SelectItem>
            );
          })}
        </ListBox>
      </Popover>
      <FieldError>{errorMessage}</FieldError>
    </Select>
  );
}
