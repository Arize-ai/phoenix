import React from "react";

import { Item, Picker, PickerProps } from "@arizeai/components";

import { UserRole } from "@phoenix/constants";

const UserRoles = Object.values(UserRole);

function isUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && role in UserRole;
}

export function RolePicker({
  onChange,
  role,
}: {
  onChange: (role: UserRole) => void;
  role: UserRole;
}) {
  return (
    <Picker
      defaultSelectedKey={role}
      aria-label="User Role"
      onSelectionChange={(key) => {
        if (isUserRole(key)) {
          onChange(key);
        }
      }}
      label="Role"
    >
      {UserRoles.map((role) => {
        return <Item key={role}>{role}</Item>;
      })}
    </Picker>
  );
}
