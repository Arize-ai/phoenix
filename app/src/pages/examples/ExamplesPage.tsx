import { Suspense } from "react";
import { Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { examplesLoader } from "./examplesLoader";
import { ExamplesTable } from "./ExamplesTable";

export function ExamplesPage() {
  const loaderData = useLoaderData<typeof examplesLoader>();
  invariant(loaderData, "loaderData is required");
  return (
    <>
      <ExamplesTable dataset={loaderData.dataset} />{" "}
      <Suspense>
        <Outlet />
      </Suspense>
    </>
  );
}
