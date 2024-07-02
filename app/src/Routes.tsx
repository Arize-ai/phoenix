import React from "react";
import { createRoutesFromElements, Route, RouterProvider } from "react-router";
import { createBrowserRouter } from "react-router-dom";

import { datasetLoaderQuery$data } from "./pages/dataset/__generated__/datasetLoaderQuery.graphql";
import { embeddingLoaderQuery$data } from "./pages/embedding/__generated__/embeddingLoaderQuery.graphql";
import { projectLoaderQuery$data } from "./pages/project/__generated__/projectLoaderQuery.graphql";
import {
  APIsPage,
  datasetLoader,
  DatasetPage,
  DatasetsPage,
  dimensionLoader,
  DimensionPage,
  embeddingLoader,
  EmbeddingPage,
  ErrorElement,
  ExamplePage,
  examplesLoader,
  ExamplesPage,
  experimentCompareLoader,
  ExperimentComparePage,
  experimentsLoader,
  ExperimentsPage,
  homeLoader,
  Layout,
  ModelPage,
  ModelRoot,
  projectLoader,
  ProjectPage,
  ProjectsPage,
  ProjectsRoot,
  TracePage,
  TracingRoot,
} from "./pages";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<Layout />} errorElement={<ErrorElement />}>
      <Route index loader={homeLoader} />
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
      <Route
        path="/projects"
        handle={{ crumb: () => "projects" }}
        element={<ProjectsRoot />}
      >
        <Route index element={<ProjectsPage />} />
        <Route
          path=":projectId"
          element={<TracingRoot />}
          loader={projectLoader}
          handle={{
            crumb: (data: projectLoaderQuery$data) => data.project.name,
          }}
        >
          <Route index element={<ProjectPage />} />
          <Route element={<ProjectPage />}>
            <Route path="traces/:traceId" element={<TracePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/datasets" handle={{ crumb: () => "datasets" }}>
        <Route index element={<DatasetsPage />} />
        <Route
          path=":datasetId"
          loader={datasetLoader}
          handle={{
            crumb: (data: datasetLoaderQuery$data) => data.dataset.name,
          }}
        >
          <Route element={<DatasetPage />} loader={datasetLoader}>
            <Route
              index
              element={<ExperimentsPage />}
              loader={experimentsLoader}
            />
            <Route
              path="experiments"
              element={<ExperimentsPage />}
              loader={experimentsLoader}
            />
            <Route
              path="examples"
              element={<ExamplesPage />}
              loader={examplesLoader}
            >
              <Route path=":exampleId" element={<ExamplePage />} />
            </Route>
          </Route>
          <Route
            path="compare"
            handle={{
              crumb: () => "compare",
            }}
            loader={experimentCompareLoader}
            element={<ExperimentComparePage />}
          />
        </Route>
      </Route>
      <Route
        path="/apis"
        element={<APIsPage />}
        handle={{
          crumb: () => "APIs",
        }}
      />
    </Route>
  ),
  {
    basename: window.Config.basename,
  }
);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
