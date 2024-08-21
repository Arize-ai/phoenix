import React from "react";

import { Item, Picker, PickerProps } from "@arizeai/components";

import { UserRole } from "@phoenix/constants";

const UserRoles = Object.values(UserRole);

function isUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && role in UserRole;
}

type RolePickerProps<T> = {
  onChange: (role: UserRole) => void;
  role: UserRole;
} & Omit<
  PickerProps<T>,
  "children" | "onSelectionChange" | "defaultSelectedKey"
>;

export function RolePicker<T>({
  onChange,
  role,
  ...pickerProps
}: RolePickerProps<T>) {
  return (
    <Picker
      label="Role"
      className="role-picker"
      defaultSelectedKey={role}
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
        return <Item key={role}>{role}</Item>;
      })}
    </Picker>
  );
}
