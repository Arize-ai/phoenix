import React from "react";
import { createRoutesFromElements, Route, RouterProvider } from "react-router";
import { createBrowserRouter, redirect } from "react-router-dom";

import { embeddingLoaderQuery$data } from "./pages/embedding/__generated__/embeddingLoaderQuery.graphql";
import {
  dimensionLoader,
  DimensionPage,
  embeddingLoader,
  EmbeddingPage,
  ErrorElement,
  Layout,
  ModelPage,
  ModelRoot,
} from "./pages";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />} errorElement={<ErrorElement />}>
      <Route index loader={() => redirect("/model")} />
      <Route
        path="/model"
        handle={{ crumb: () => "model" }}
        element={<ModelRoot />}
      >
        <Route index element={<ModelPage />} />
        <Route element={<ModelPage />}>
          <Route path="dimensions">
            <Route
              path=":dimensionId"
              element={<DimensionPage />}
              loader={dimensionLoader}
            />
          </Route>
        </Route>
        <Route path="embeddings">
          <Route
            path=":embeddingDimensionId"
            element={<EmbeddingPage />}
            loader={embeddingLoader}
            handle={{
              // `crumb` is your own abstraction, we decided
              // to make this one a function so we can pass
              // the data from the loader to it so that our
              // breadcrumb is made up of dynamic content
              crumb: (data: embeddingLoaderQuery$data) => data.embedding.name,
            }}
          />
        </Route>
      </Route>
    </Route>
  )
);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
