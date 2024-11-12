import React, { Suspense } from "react";
import { Outlet } from "react-router";

import { Playground } from "./Playground";

export function PlaygroundPage() {
  return (
    <>
      <Playground />
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
