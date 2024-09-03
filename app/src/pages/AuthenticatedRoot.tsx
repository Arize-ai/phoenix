import React from "react";
import { useLoaderData } from "react-router";

import { ViewerProvider } from "@phoenix/contexts/ViewerContext";

import { authenticatedRootLoaderQuery$data } from "./__generated__/authenticatedRootLoaderQuery.graphql";
import { Layout } from "./Layout";

/**
 * The root of the authenticated application. Note that authentication might be entirely disabled
 */
export function AuthenticatedRoot() {
  const loaderData = useLoaderData() as authenticatedRootLoaderQuery$data;
  return (
    <ViewerProvider query={loaderData}>
      <Layout />
    </ViewerProvider>
  );
}
