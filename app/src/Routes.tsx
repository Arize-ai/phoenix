import React from "react";
import { createRoutesFromElements, Route, RouterProvider } from "react-router";
import { createBrowserRouter } from "react-router-dom";

import { embeddingLoaderQuery$data } from "./pages/embedding/__generated__/embeddingLoaderQuery.graphql";
import {
  Dimension,
  dimensionLoader,
  Embedding,
  embeddingLoader,
  ErrorElement,
  Home,
  Layout,
} from "./pages";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route
      path="/"
      element={<Layout />}
      handle={{ crumb: () => "Home" }}
      errorElement={<ErrorElement />}
    >
      <Route index element={<Home />} />
      <Route element={<Home />}>
        <Route path="/dimensions">
          <Route
            path="/dimensions/:dimensionId"
            element={<Dimension />}
            loader={dimensionLoader}
          />
        </Route>
      </Route>
      <Route path="/embeddings">
        <Route
          path="/embeddings/:embeddingDimensionId"
          element={<Embedding />}
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
  )
);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
