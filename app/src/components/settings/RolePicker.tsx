import { css } from "@emotion/react";

import { Item, Picker, PickerProps } from "@arizeai/components";

import { isUserRole, normalizeUserRole, UserRole } from "@phoenix/constants";

const UserRoles = Object.values(UserRole);

const hiddenLabelCSS = css`
  .ac-field-label {
    display: none;
  }
`;

type RolePickerProps<T> = {
  onChange: (role: UserRole) => void;
  role?: UserRole;
  /**
   * Whether to display a label for the picker
   * This may be set to false in cases where the picker is rendered in a table for instance
   * @default true
   */
  includeLabel?: boolean;
} & Omit<
  PickerProps<T>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function RolePicker<T>({
  onChange,
  role,
  includeLabel = true,
  ...pickerProps
}: RolePickerProps<T>) {
  return (
    <Picker
      css={!includeLabel ? hiddenLabelCSS : undefined}
      label={"Role"}
      className="role-picker"
      defaultSelectedKey={role ?? undefined}
      aria-label="User Role"
      onSelectionChange={(key) => {
        if (isUserRole(key)) {
          onChange(key);
        }
      }}
      width={"100%"}
      {...pickerProps}
    >
      {UserRoles.map((role) => {
        return <Item key={role}>{normalizeUserRole(role)}</Item>;
      })}
    </Picker>
  );
}
