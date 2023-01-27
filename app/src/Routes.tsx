import React from "react";
import { Route, createRoutesFromElements, RouterProvider } from "react-router";
import { Home, Embedding, embeddingLoader, Layout } from "./pages";
import { createBrowserRouter } from "react-router-dom";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />}>
      <Route index element={<Home />} />
      <Route
        path="/embeddings/:embeddingDimensionId"
        element={<Embedding />}
        loader={embeddingLoader}
      />
    </Route>
  )
);
export function AppRoutes() {
  return <RouterProvider router={router} />;
}
