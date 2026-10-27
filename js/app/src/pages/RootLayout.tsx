import { Outlet } from "react-router";

import { UnsavedChangesProvider } from "@phoenix/hooks";

export function RootLayout() {
  return (
    <UnsavedChangesProvider>
      <Outlet />
    </UnsavedChangesProvider>
  );
}
