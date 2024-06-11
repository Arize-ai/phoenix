import React from "react";
import { useLoaderData } from "react-router";

import { experimentsLoaderQuery$data } from "./__generated__/experimentsLoaderQuery.graphql";
import { ExperimentsTable } from "./ExperimentsTable";

export function ExperimentsPage() {
  const loaderData = useLoaderData() as experimentsLoaderQuery$data;
  return <ExperimentsTable dataset={loaderData.dataset} />;
}
