import React from "react";
import { Route, createRoutesFromElements, RouterProvider } from "react-router";
import { Home, Embedding, embeddingLoader, Layout } from "./pages";
import { createBrowserRouter } from "react-router-dom";
import { EmbeddingLoaderQuery$data } from "./pages/__generated__/EmbeddingLoaderQuery.graphql";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />} handle={{ crumb: () => "Home" }}>
      <Route index element={<Home />} />
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
            crumb: (data: EmbeddingLoaderQuery$data) => data.embedding.name,
          }}
        />
      </Route>
    </Route>
  )
);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
