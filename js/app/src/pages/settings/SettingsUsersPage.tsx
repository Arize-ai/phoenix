import { Outlet } from "react-router";

import { UsersCard } from "@phoenix/pages/settings/UsersCard";

export function SettingsUsersPage() {
  return (
    <>
      <UsersCard />
      <Outlet />
    </>
  );
}
