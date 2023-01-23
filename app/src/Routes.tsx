import React from "react";
import { Routes, Route } from "react-router";
import { Home, EmbeddingDetails } from "./pages";
import { BrowserRouter } from "react-router-dom";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />}></Route>
        <Route
          path="/embeddings/:embeddingDimensionId"
          element={<EmbeddingDetails />}
        ></Route>
      </Routes>
    </BrowserRouter>
  );
}
