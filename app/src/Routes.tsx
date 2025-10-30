import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
} from "react-router";
import { RouterProvider } from "react-router/dom";

import { DatasetEvaluatorsPage } from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorsPage";
import { NewEvaluatorPage } from "@phoenix/pages/evaluators/NewEvaluatorPage";
import { RootLayout } from "@phoenix/pages/RootLayout";
import { settingsPromptsPageLoader } from "@phoenix/pages/settings/prompts/settingsPromptsPageLoader";
import { SettingsAIProvidersPage } from "@phoenix/pages/settings/SettingsAIProvidersPage";
import { settingsAIProvidersPageLoader } from "@phoenix/pages/settings/settingsAIProvidersPageLoader";
import { SettingsAnnotationsPage } from "@phoenix/pages/settings/SettingsAnnotationsPage";
import { settingsAnnotationsPageLoader } from "@phoenix/pages/settings/settingsAnnotationsPageLoader";
import { SettingsDataPage } from "@phoenix/pages/settings/SettingsDataPage";
import { SettingsGeneralPage } from "@phoenix/pages/settings/SettingsGeneralPage";
import { settingsModelsLoader } from "@phoenix/pages/settings/settingsModelsLoader";
import { SettingsModelsPage } from "@phoenix/pages/settings/SettingsModelsPage";

import { embeddingLoaderQuery$data } from "./pages/embedding/__generated__/embeddingLoaderQuery.graphql";
import { Layout } from "./pages/Layout";
import { ProjectConfigPage } from "./pages/project/ProjectConfigPage";
import { ProjectRoot } from "./pages/project/ProjectRoot";
import { promptConfigLoader } from "./pages/prompt/promptConfigLoader";
import { PromptIndexPage } from "./pages/prompt/PromptIndexPage";
import { PromptLayout } from "./pages/prompt/PromptLayout";
import { promptPlaygroundLoader } from "./pages/prompt/promptPlaygroundLoader";
import { PromptPlaygroundPage } from "./pages/prompt/PromptPlaygroundPage";
import { PromptVersionDetailsPage } from "./pages/prompt/PromptVersionDetailsPage";
import {
  promptVersionLoader,
  PromptVersionLoaderData,
} from "./pages/prompt/promptVersionLoader";
import { promptVersionsLoader } from "./pages/prompt/promptVersionsLoader";
import { PromptVersionsPage } from "./pages/prompt/PromptVersionsPage";
import { sessionRedirectLoader } from "./pages/redirects/sessionRedirectLoader";
import { spanRedirectLoader } from "./pages/redirects/spanRedirectLoader";
import { traceRedirectLoader } from "./pages/redirects/traceRedirectLoader";
import { settingsDataPageLoader } from "./pages/settings/settingsDataPageLoader";
import { sessionLoader } from "./pages/trace/sessionLoader";
import {
  APIsPage,
  AuthenticatedRoot,
  authenticatedRootLoader,
  datasetLoader,
  DatasetLoaderData,
  DatasetPage,
  DatasetsPage,
  datasetVersionsLoader,
  DatasetVersionsPage,
  dimensionLoader,
  DimensionPage,
  embeddingLoader,
  EmbeddingPage,
  ErrorElement,
  ExamplePage,
  examplesLoader,
  ExamplesPage,
  ExperimentComparePage,
  ExperimentsPage,
  ForgotPasswordPage,
  homeLoader,
  LoggedOutPage,
  LoginPage,
  ModelInferencesPage,
  ModelRoot,
  PlaygroundPage,
  ProfilePage,
  ProjectIndexPage,
  projectLoader,
  ProjectLoaderData,
  ProjectMetricsPage,
  ProjectPage,
  ProjectSessionsPage,
  ProjectsPage,
  ProjectSpansPage,
  ProjectsRoot,
  ProjectTracesPage,
  PromptConfigPage,
  promptLoader,
  PromptLoaderData,
  promptsLoader,
  PromptsPage,
  resetPasswordLoader,
  ResetPasswordPage,
  ResetPasswordWithTokenPage,
  SessionPage,
  SettingsDatasetsPage,
  settingsGeneralPageLoader,
  SettingsPage,
  SettingsPromptsPage,
  SpanPlaygroundPage,
  spanPlaygroundPageLoader,
  SpanPlaygroundPageLoaderData,
  SupportPage,
  TracePage,
} from "./pages";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" errorElement={<ErrorElement />} element={<RootLayout />}>
      {/*
        Using /v1/* below redirects all /v1/* routes that don't have a GET method to the root path.
        In particular, this redirects /v1/traces to the root path (/). This route is for the
        OpenTelemetry trace collector, but users sometimes accidentally try to access Phoenix
        through this URL in their browser, leading to confusion. This redirect helps prevent
        those issues by sending them to the main application.
      */}
      <Route path="/v1/*" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LoggedOutPage />} />
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
            <Route index element={<ModelInferencesPage />} />
            <Route element={<ModelInferencesPage />}>
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
            handle={{ crumb: () => "Projects" }}
            element={<ProjectsRoot />}
          >
            <Route index element={<ProjectsPage />} />
            <Route
              path=":projectId"
              loader={projectLoader}
              handle={{
                crumb: (data: ProjectLoaderData) => data?.project?.name,
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
                <Route path="metrics" element={<ProjectMetricsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="/datasets" handle={{ crumb: () => "Datasets" }}>
            <Route index element={<DatasetsPage />} />
            <Route
              path=":datasetId"
              loader={datasetLoader}
              handle={{
                crumb: (data: DatasetLoaderData) => data?.dataset?.name,
              }}
            >
              <Route element={<DatasetPage />} loader={datasetLoader}>
                <Route index element={<ExperimentsPage />} />
                <Route path="experiments" element={<ExperimentsPage />} />
                <Route
                  path="examples"
                  element={<ExamplesPage />}
                  loader={examplesLoader}
                >
                  <Route path=":exampleId" element={<ExamplePage />} />
                </Route>
                <Route
                  path="versions"
                  element={<DatasetVersionsPage />}
                  loader={datasetVersionsLoader}
                />
                <Route path="evaluators" element={<DatasetEvaluatorsPage />} />
              </Route>
              <Route
                path="compare"
                element={<ExperimentComparePage />}
                handle={{ crumb: () => "compare" }}
              />
            </Route>
          </Route>
          <Route
            path="/playground"
            handle={{
              crumb: () => "Playground", // TODO: add playground name
            }}
          >
            <Route index element={<PlaygroundPage />} />
            <Route
              path="spans/:spanId"
              element={<SpanPlaygroundPage />}
              loader={spanPlaygroundPageLoader}
              handle={{
                crumb: (data: SpanPlaygroundPageLoaderData) => {
                  if (data?.span.__typename === "Span") {
                    return `span ${data?.span?.spanId}`;
                  }
                  return "span unknown";
                },
              }}
            />
          </Route>
          <Route path="/evaluators" handle={{ crumb: () => "Evaluators" }}>
            <Route index element={<Navigate to="new" replace />} />
            <Route
              path="new"
              element={<NewEvaluatorPage />}
              handle={{ crumb: () => "New evaluator" }}
            />
          </Route>
          <Route
            path="/prompts"
            handle={{
              crumb: () => "Prompts",
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
                crumb: (data: PromptLoaderData) => {
                  if (data?.prompt?.__typename === "Prompt") {
                    return data?.prompt?.name;
                  }
                  return "prompt unknown";
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
              {/*
               * Adds a duplicative versions/:versionId route group that bails out of
               * the PromptLayout so that the version playground is not nested
               */}
              <Route
                path="versions/:versionId"
                loader={promptVersionLoader}
                handle={{
                  crumb: (data: PromptVersionLoaderData) =>
                    data?.promptVersion.id,
                }}
              >
                <Route
                  path="playground"
                  element={<PromptPlaygroundPage />}
                  loader={promptPlaygroundLoader}
                  handle={{
                    crumb: () => "playground",
                  }}
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
              crumb: () => "APIs", // TODO: add API name
            }}
          />
          <Route
            path="/support"
            element={<SupportPage />}
            handle={{
              crumb: () => "Support",
            }}
          />
          <Route
            path="/settings"
            element={<SettingsPage />}
            handle={{
              crumb: () => "Settings",
            }}
          >
            <Route
              path="general"
              loader={settingsGeneralPageLoader}
              element={<SettingsGeneralPage />}
              handle={{
                crumb: () => "General",
              }}
            />
            <Route
              path="providers"
              loader={settingsAIProvidersPageLoader}
              element={<SettingsAIProvidersPage />}
              handle={{
                crumb: () => "AI Providers",
              }}
            />
            <Route
              path="models"
              loader={settingsModelsLoader}
              element={<SettingsModelsPage />}
              handle={{
                crumb: () => "Models",
              }}
            />
            <Route
              path="datasets"
              element={<SettingsDatasetsPage />}
              handle={{
                crumb: () => "Datasets",
              }}
            />
            <Route
              path="annotations"
              loader={settingsAnnotationsPageLoader}
              element={<SettingsAnnotationsPage />}
              handle={{
                crumb: () => "Annotations",
              }}
            />
            <Route
              path="data"
              element={<SettingsDataPage />}
              handle={{
                crumb: () => "Data Retention",
              }}
              loader={settingsDataPageLoader}
            />
            <Route
              path="prompts"
              element={<SettingsPromptsPage />}
              loader={settingsPromptsPageLoader}
              handle={{
                crumb: () => "Prompts",
              }}
            />
          </Route>
          <Route
            path="/redirects/spans/:span_otel_id"
            loader={spanRedirectLoader}
            errorElement={<ErrorElement />}
          />
          <Route
            path="/redirects/traces/:trace_otel_id"
            loader={traceRedirectLoader}
            errorElement={<ErrorElement />}
          />
          <Route
            path="/redirects/sessions/:session_id"
            loader={sessionRedirectLoader}
            errorElement={<ErrorElement />}
          />
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
