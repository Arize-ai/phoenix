import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
} from "react-router";
import { RouterProvider } from "react-router/dom";

import { SettingsAIProvidersPage } from "@phoenix/pages/settings/SettingsAIProvidersPage";
import { settingsAIProvidersPageLoader } from "@phoenix/pages/settings/settingsAIProvidersPageLoader";
import { SettingsAnnotationsPage } from "@phoenix/pages/settings/SettingsAnnotationsPage";
import { settingsAnnotationsPageLoader } from "@phoenix/pages/settings/settingsAnnotationsPageLoader";
import { SettingsDataPage } from "@phoenix/pages/settings/SettingsDataPage";
import { SettingsGeneralPage } from "@phoenix/pages/settings/SettingsGeneralPage";

import {
  DashboardPage,
  projectDashboardLoader,
  ProjectDashboardPage,
} from "./pages/dashboard";
import { projectDashboardLoaderQuery$data } from "./pages/dashboard/__generated__/projectDashboardLoaderQuery.graphql";
import {
  dashboardsLoader,
  DashboardsPage,
  DashboardsRoot,
} from "./pages/dashboards";
import { datasetLoaderQuery$data } from "./pages/dataset/__generated__/datasetLoaderQuery.graphql";
import { embeddingLoaderQuery$data } from "./pages/embedding/__generated__/embeddingLoaderQuery.graphql";
import { Layout } from "./pages/Layout";
import { spanPlaygroundPageLoaderQuery$data } from "./pages/playground/__generated__/spanPlaygroundPageLoaderQuery.graphql";
import { projectLoaderQuery$data } from "./pages/project/__generated__/projectLoaderQuery.graphql";
import { ProjectConfigPage } from "./pages/project/ProjectConfigPage";
import { ProjectRoot } from "./pages/project/ProjectRoot";
import { promptLoaderQuery$data } from "./pages/prompt/__generated__/promptLoaderQuery.graphql";
import { promptConfigLoader } from "./pages/prompt/promptConfigLoader";
import { PromptIndexPage } from "./pages/prompt/PromptIndexPage";
import { PromptLayout } from "./pages/prompt/PromptLayout";
import { promptPlaygroundLoader } from "./pages/prompt/promptPlaygroundLoader";
import { PromptPlaygroundPage } from "./pages/prompt/PromptPlaygroundPage";
import { PromptVersionDetailsPage } from "./pages/prompt/PromptVersionDetailsPage";
import { promptVersionLoader } from "./pages/prompt/promptVersionLoader";
import { promptVersionsLoader } from "./pages/prompt/promptVersionsLoader";
import { PromptVersionsPage } from "./pages/prompt/PromptVersionsPage";
import { settingsDataPageLoader } from "./pages/settings/settingsDataPageLoader";
import { sessionLoader } from "./pages/trace/sessionLoader";
import { SessionPage } from "./pages/trace/SessionPage";
import {
  APIsPage,
  AuthenticatedRoot,
  authenticatedRootLoader,
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
  ForgotPasswordPage,
  homeLoader,
  LoginPage,
  ModelPage,
  ModelRoot,
  PlaygroundPage,
  ProfilePage,
  ProjectIndexPage,
  projectLoader,
  ProjectPage,
  ProjectSessionsPage,
  ProjectsPage,
  ProjectSpansPage,
  ProjectsRoot,
  ProjectTracesPage,
  PromptConfigPage,
  promptLoader,
  promptsLoader,
  PromptsPage,
  resetPasswordLoader,
  ResetPasswordPage,
  ResetPasswordWithTokenPage,
  settingsGeneralPageLoader,
  SettingsPage,
  SpanPlaygroundPage,
  spanPlaygroundPageLoader,
  SupportPage,
  TracePage,
} from "./pages";
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" errorElement={<ErrorElement />}>
      {/* 
        Using /v1/* below redirects all /v1/* routes that don't have a GET method to the root path.
        In particular, this redirects /v1/traces to the root path (/). This route is for the
        OpenTelemetry trace collector, but users sometimes accidentally try to access Phoenix
        through this URL in their browser, leading to confusion. This redirect helps prevent
        those issues by sending them to the main application.
      */}
      <Route path="/v1/*" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
        loader={resetPasswordLoader}
      />
      <Route
        path="/reset-password-with-token"
        element={<ResetPasswordWithTokenPage />}
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route element={<AuthenticatedRoot />} loader={authenticatedRootLoader}>
        <Route element={<Layout />}>
          <Route
            path="/profile"
            handle={{ crumb: () => "profile" }}
            element={<ProfilePage />}
          />
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
                  crumb: (data: embeddingLoaderQuery$data) =>
                    data.embedding.name,
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
              loader={projectLoader}
              handle={{
                crumb: (data: projectLoaderQuery$data) => data.project.name,
              }}
              element={<ProjectRoot />}
            >
              <Route index element={<ProjectIndexPage />} />
              <Route element={<ProjectPage />}>
                <Route path="traces" element={<ProjectTracesPage />}>
                  <Route path=":traceId" element={<TracePage />} />
                </Route>
                <Route path="spans" element={<ProjectSpansPage />}>
                  <Route path=":traceId" element={<TracePage />} />
                </Route>
                <Route path="sessions" element={<ProjectSessionsPage />}>
                  <Route
                    path=":sessionId"
                    element={<SessionPage />}
                    loader={sessionLoader}
                  />
                </Route>
                <Route path="config" element={<ProjectConfigPage />} />
              </Route>
            </Route>
          </Route>
          <Route
            path="/dashboards"
            handle={{ crumb: () => "dashboards" }}
            element={<DashboardsRoot />}
          >
            <Route
              index
              element={<DashboardsPage />}
              loader={dashboardsLoader}
            />
            <Route
              path="projects/:projectId"
              element={<ProjectDashboardPage />}
              loader={projectDashboardLoader}
              handle={{
                crumb: (data: projectDashboardLoaderQuery$data) =>
                  data.project.name,
              }}
            />
            <Route
              path=":dashboardId"
              handle={{
                // TODO: add dashboard name
                crumb: () => "dashboard",
              }}
              element={<DashboardPage />}
            />
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
            path="/playground"
            handle={{
              crumb: () => "Playground",
            }}
          >
            <Route index element={<PlaygroundPage />} />
            <Route
              path="spans/:spanId"
              element={<SpanPlaygroundPage />}
              loader={spanPlaygroundPageLoader}
              handle={{
                crumb: (data: spanPlaygroundPageLoaderQuery$data) => {
                  if (data.span.__typename === "Span") {
                    return `span ${data.span.spanId}`;
                  }
                  return "span unknown";
                },
              }}
            />
          </Route>
          <Route
            path="/prompts"
            handle={{
              crumb: () => "prompts",
            }}
          >
            <Route index element={<PromptsPage />} loader={promptsLoader} />
            <Route
              path=":promptId"
              loader={promptLoader}
              // force this route to always revalidate, preventing stale versions from being
              // displayed when navigating back to the prompt page after gql mutation
              shouldRevalidate={() => true}
              handle={{
                crumb: (data: promptLoaderQuery$data) => {
                  if (data.prompt.__typename === "Prompt") {
                    return data.prompt.name;
                  }
                  return "unknown";
                },
              }}
            >
              <Route element={<PromptLayout />}>
                <Route index element={<PromptIndexPage />} />
                <Route
                  path="versions"
                  loader={promptVersionsLoader}
                  element={<PromptVersionsPage />}
                >
                  <Route
                    path=":versionId"
                    loader={promptVersionLoader}
                    element={<PromptVersionDetailsPage />}
                  />
                </Route>
                <Route
                  path="config"
                  element={<PromptConfigPage />}
                  loader={promptConfigLoader}
                />
              </Route>
              <Route
                path="playground"
                element={<PromptPlaygroundPage />}
                loader={promptPlaygroundLoader}
                handle={{
                  crumb: () => "playground",
                }}
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
          <Route
            path="/support"
            element={<SupportPage />}
            handle={{
              crumb: () => "support",
            }}
          />
          <Route
            path="/settings"
            element={<SettingsPage />}
            handle={{
              crumb: () => "settings",
            }}
          >
            <Route
              path="general"
              loader={settingsGeneralPageLoader}
              element={<SettingsGeneralPage />}
              handle={{
                crumb: () => "general",
              }}
            />
            <Route
              path="providers"
              loader={settingsAIProvidersPageLoader}
              element={<SettingsAIProvidersPage />}
              handle={{
                crumb: () => "providers",
              }}
            />
            <Route
              path="annotations"
              loader={settingsAnnotationsPageLoader}
              element={<SettingsAnnotationsPage />}
              handle={{
                crumb: () => "annotations",
              }}
            />
            <Route
              path="data"
              element={<SettingsDataPage />}
              handle={{
                crumb: () => "data retention",
              }}
              loader={settingsDataPageLoader}
            />
          </Route>
        </Route>
      </Route>
    </Route>
  ),
  {
    basename: window.Config.basename,
  }
);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
