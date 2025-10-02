import { Outlet } from "react-router";

import { ToastRegion } from "@phoenix/components/toast/ToastRegion";

export function RootLayout() {
  return (
    <>
      <ToastRegion />
      <Outlet />
    </>
  );
}
