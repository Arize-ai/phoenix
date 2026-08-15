import { Outlet } from "react-router";

import { ToastRegion } from "@phoenix/components/core/toast/ToastRegion";

export function RootLayout() {
  return (
    <>
      <ToastRegion />
      <Outlet />
    </>
  );
}
