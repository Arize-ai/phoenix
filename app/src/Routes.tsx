import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  type ShouldRevalidateFunction,
} from "react-router";
import { RouterProvider } from "react-router/dom";

import { buildRouteInfoCatalog } from "@phoenix/agent/tools/getRouteInfo/catalog";
import { registerRouteInfoCatalog } from "@phoenix/agent/tools/getRouteInfo/routeCatalogRegistry";
import type { DatasetEvaluatorDetailsLoaderData } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorDetailsLoader";
import { datasetEvaluatorDetailsLoader } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorDetailsLoader";
import { DatasetEvaluatorDetailsPage } from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorDetailsPage";
import { datasetEvaluatorsLoader } from "@phoenix/pages/dataset/evaluators/datasetEvaluatorsLoader";
import { DatasetEvaluatorsPage } from "@phoenix/pages/dataset/evaluators/DatasetEvaluatorsPage";
import {
  EVALUATOR_DETAILS_ROUTE_ID,
  EvaluatorTracePage,
} from "@phoenix/pages/dataset/evaluators/EvaluatorTracePage";
import { EvaluatorsPage } from "@phoenix/pages/evaluators/EvaluatorsPage";
import { evaluatorsPageLoader } from "@phoenix/pages/evaluators/evaluatorsPageLoader";
import { RootLayout } from "@phoenix/pages/RootLayout";
import { settingsPromptsPageLoader } from "@phoenix/pages/settings/prompts/settingsPromptsPageLoader";
import { SettingsSecretsPage } from "@phoenix/pages/settings/secrets/SettingsSecretsPage";
import { settingsSecretsPageLoader } from "@phoenix/pages/settings/secrets/settingsSecretsPageLoader";
import { settingsAgentsPageLoader } from "@phoenix/pages/settings/settingsAgentsPageLoader";
import { SettingsAIProvidersPage } from "@phoenix/pages/settings/SettingsAIProvidersPage";
import { settingsAIProvidersPageLoader } from "@phoenix/pages/settings/settingsAIProvidersPageLoader";
import { SettingsAnnotationsPage } from "@phoenix/pages/settings/SettingsAnnotationsPage";
import { settingsAnnotationsPageLoader } from "@phoenix/pages/settings/settingsAnnotationsPageLoader";
import { SettingsAPIKeysPage } from "@phoenix/pages/settings/SettingsAPIKeysPage";
import { SettingsDataPage } from "@phoenix/pages/settings/SettingsDataPage";
import { SettingsGeneralPage } from "@phoenix/pages/settings/SettingsGeneralPage";
import { SettingsMCPPage } from "@phoenix/pages/settings/SettingsMCPPage";
import { settingsModelsLoader } from "@phoenix/pages/settings/settingsModelsLoader";
import { SettingsModelsPage } from "@phoenix/pages/settings/SettingsModelsPage";
import { SettingsSandboxesPage } from "@phoenix/pages/settings/SettingsSandboxesPage";
import { settingsSandboxesPageLoader } from "@phoenix/pages/settings/settingsSandboxesPageLoader";
import { SettingsUsersPage } from "@phoenix/pages/settings/SettingsUsersPage";
import { UserDetailsDrawer } from "@phoenix/pages/settings/UserDetailsDrawer";
import {
  buildRouteNavigationCatalog,
  registerRouteNavigationCatalog,
} from "@phoenix/routing/routeNavigation";

import type {
  DatasetLoaderData,
  ProjectLoaderData,
  PromptLoaderData,
  SpanPlaygroundPageLoaderData,
} from "./pages";
import {
  AuthenticatedRoot,
  authenticatedRootLoader,
  dashboardsLoader,
  DashboardsEmptyPage,
  DashboardsRoot,
  datasetLoader,
  DatasetMetricsPage,
  DatasetPage,
  DatasetsPage,
  datasetVersionsLoader,
  DatasetVersionsPage,
  ErrorElement,
  ExamplePage,
  examplesLoader,
  ExamplesPage,
  ExperimentComparePage,
  ExperimentDetailPage,
  ExperimentsPage,
  ForgotPasswordPage,
  homeLoader,
  LoggedOutPage,
  LoginPage,
  OAuth2ConsentPage,
  PlaygroundPage,
  playgroundPageLoader,
  ProfileAccountPage,
  ProfileAPIKeysPage,
  ProfileAuthorizedApplicationsPage,
  ProfilePage,
  ProfilePreferencesPage,
  ProjectIndexPage,
  projectLoader,
  ProjectMetricsPage,
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
  SessionPage,
  SettingsDatasetsPage,
  settingsGeneralPageLoader,
  SettingsPage,
  SettingsPromptsPage,
  SettingsAgentsPage,
  SpanPlaygroundPage,
  spanPlaygroundPageLoader,
  SupportPage,
  TracePage,
} from "./pages";
import { GraphQLPage } from "./pages/apis/GraphQLPage";
import { RestAPIPage } from "./pages/apis/RestAPIPage";
import { Layout } from "./pages/Layout";
import { layoutLoader } from "./pages/layoutLoader";
import { ProjectConfigPage } from "./pages/project/ProjectConfigPage";
import { ProjectRoot } from "./pages/project/ProjectRoot";
import { promptConfigLoader } from "./pages/prompt/promptConfigLoader";
import { PromptIndexPage } from "./pages/prompt/PromptIndexPage";
import { PromptLayout } from "./pages/prompt/PromptLayout";
import { PromptVersionDetailsPage } from "./pages/prompt/PromptVersionDetailsPage";
import { promptVersionLoader } from "./pages/prompt/promptVersionLoader";
import { promptVersionsLoader } from "./pages/prompt/promptVersionsLoader";
import { PromptVersionsPage } from "./pages/prompt/PromptVersionsPage";
import { exampleRedirectLoader } from "./pages/redirects/exampleRedirectLoader";
import { projectRedirectLoader } from "./pages/redirects/projectRedirectLoader";
import { promptTagRedirectLoader } from "./pages/redirects/promptTagRedirectLoader";
import { sessionRedirectLoader } from "./pages/redirects/sessionRedirectLoader";
import { spanRedirectLoader } from "./pages/redirects/spanRedirectLoader";
import { traceRedirectLoader } from "./pages/redirects/traceRedirectLoader";
import { settingsDataPageLoader } from "./pages/settings/settingsDataPageLoader";
import { sessionLoader } from "./pages/trace/sessionLoader";

// Skip loader revalidation when only the URL search params or hash change.
// Why: some pages persist view state (e.g. a selected row) via setSearchParams,
// and react-router's default behavior is to re-run every matched loader on any
// navigation — including search-param-only updates — which causes avoidable
// network fetches on trivial UI interactions.
const revalidateOnPathChange: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
};

export const appRouteObjects = createRoutesFromElements(
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
    <Route path="/oauth2/consent" element={<OAuth2ConsentPage />} />
    {/*
        When authentication is enabled the server handles /oauth2/authorize
        before the SPA ever sees it. This route only renders when the server
        is running without authentication and falls through to the SPA — the
        page then shows an "authentication is not enabled" fallback instead
        of crashing on an unknown route.
      */}
    <Route path="/oauth2/authorize" element={<OAuth2ConsentPage />} />
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
    <Route
      element={<AuthenticatedRoot />}
      loader={authenticatedRootLoader}
      shouldRevalidate={revalidateOnPathChange}
    >
      <Route
        element={<Layout />}
        loader={layoutLoader}
        shouldRevalidate={revalidateOnPathChange}
      >
        <Route
          path="/profile"
          handle={{
            crumb: () => "Profile",
            agentRoute: {
              label: "Profile",
              description:
                "Open personal account settings, API keys, connected applications, and display preferences.",
            },
          }}
          element={<ProfilePage />}
        >
          <Route
            path="account"
            element={<ProfileAccountPage />}
            handle={{
              crumb: () => "Account",
              agentRoute: {
                label: "Profile Account",
                description:
                  "View your email and role, update your username, and reset your local password.",
              },
              navigation: {
                section: "Profile",
                label: "Account",
                description: "Username, email, role, and password",
                icon: "Person",
                requiresViewer: true,
              },
            }}
          />
          <Route
            path="api-keys"
            element={<ProfileAPIKeysPage />}
            handle={{
              crumb: () => "API Keys",
              agentRoute: {
                label: "Profile API Keys",
                description:
                  "Create, view, and revoke personal API keys for programmatic access.",
              },
              navigation: {
                section: "Profile",
                label: "API Keys",
                description: "Personal keys for programmatic access",
                icon: "Key",
                requiresViewer: true,
              },
            }}
          />
          <Route
            path="apps"
            element={<ProfileAuthorizedApplicationsPage />}
            handle={{
              crumb: () => "Apps",
              agentRoute: {
                label: "Profile Apps",
                description:
                  "Review and revoke OAuth applications connected to your Phoenix account.",
              },
              navigation: {
                section: "Profile",
                label: "Apps",
                description: "OAuth apps connected to your account",
                icon: "Link2",
                requiresViewer: true,
              },
            }}
          />
          <Route
            path="preferences"
            element={<ProfilePreferencesPage />}
            handle={{
              crumb: () => "Preferences",
              agentRoute: {
                label: "Profile Preferences",
                description:
                  "Choose your theme, timezone, code language, and package manager defaults.",
              },
              navigation: {
                section: "Profile",
                label: "Preferences",
                description: "Theme, timezone, and code defaults",
                icon: "Options",
              },
            }}
          />
          <Route path="*" />
        </Route>
        <Route index loader={homeLoader} />
        <Route
          path="/projects"
          handle={{
            crumb: () => "Projects",
            agentRoute: {
              label: "Projects",
              description:
                "Browse the project list and open project-specific observability views.",
            },
            navigation: {
              section: "Pages",
              label: "Tracing",
              description: "Projects, traces, and spans",
              icon: "Trace",
            },
          }}
          element={<ProjectsRoot />}
        >
          <Route index element={<ProjectsPage />} />
          <Route
            path=":projectId"
            loader={projectLoader}
            shouldRevalidate={revalidateOnPathChange}
            handle={{
              crumb: (data: ProjectLoaderData) => data?.project?.name,
              agentRoute: {
                label: "Project Overview",
                description:
                  "Open a project's default overview, project home, and summary page.",
              },
              copy: (data: ProjectLoaderData) => [
                {
                  name: "Project Name",
                  value: data?.project?.name,
                  iconKey: "Text" as const,
                },
                {
                  name: "Project ID",
                  value: data?.project?.id,
                  iconKey: "ID" as const,
                },
              ],
            }}
            element={<ProjectRoot />}
          >
            <Route index element={<ProjectIndexPage />} />
            <Route element={<ProjectPage />}>
              <Route
                path="traces"
                element={<ProjectTracesPage />}
                handle={{
                  agentRoute: {
                    label: "Project Traces",
                    description:
                      "Inspect project traces in the trace table and open trace details. Supports configurable metric charts shown above the table.",
                  },
                }}
              >
                <Route
                  path=":traceId"
                  element={<TracePage />}
                  handle={{
                    agentRoute: {
                      label: "Trace Details",
                      description:
                        "Inspect the span tree, spans, and trace view details for a single trace. The traceId route param uses the GraphQL Trace.traceId OpenTelemetry trace ID, not Trace.id. Supports selecting a span with selectedSpanNodeId.",
                    },
                  }}
                />
              </Route>
              <Route
                path="spans"
                element={<ProjectSpansPage />}
                handle={{
                  agentRoute: {
                    label: "Project Spans",
                    description:
                      "Inspect the project span table and filter spans for a project. Supports configurable metric charts shown above the table.",
                  },
                }}
              >
                <Route
                  path=":traceId"
                  element={<TracePage />}
                  handle={{
                    agentRoute: {
                      label: "Trace Details",
                      description:
                        "Inspect the span tree, spans, and trace view details for a single trace. The traceId route param uses the GraphQL Trace.traceId OpenTelemetry trace ID, not Trace.id. Supports selecting a span with selectedSpanNodeId.",
                    },
                  }}
                />
              </Route>
              <Route
                path="sessions"
                element={<ProjectSessionsPage />}
                handle={{
                  agentRoute: {
                    label: "Project Sessions",
                    description:
                      "Browse user or application sessions and the session list for a project. Supports configurable metric charts shown above the table, with a stats side panel showing session count, average session duration, and session annotation summaries.",
                  },
                }}
              >
                <Route
                  path=":sessionId"
                  element={<SessionPage />}
                  loader={sessionLoader}
                  shouldRevalidate={revalidateOnPathChange}
                  handle={{
                    agentRoute: {
                      label: "Session Details",
                      description:
                        "Inspect session traces, turns, and details for a single session. The sessionId route param uses the GraphQL ProjectSession.id Relay node ID, not ProjectSession.sessionId. Supports selecting a session trace span with selectedSpanNodeId.",
                    },
                  }}
                />
              </Route>
              <Route
                path="config"
                element={<ProjectConfigPage />}
                handle={{
                  agentRoute: {
                    label: "Project Configuration",
                    description:
                      "Configure project settings including display details, default tab, and data retention policy assignment.",
                  },
                }}
              />
              <Route
                path="metrics"
                element={<ProjectMetricsPage />}
                handle={{
                  agentRoute: {
                    label: "Project Metrics",
                    description:
                      "View project time-series metrics, token usage breakdowns, cache read/write token charts, and observability panels.",
                  },
                }}
              />
            </Route>
          </Route>
        </Route>
        <Route
          path="/dashboards"
          handle={{
            crumb: () => "Dashboards",
            agentRoute: {
              label: "Dashboards",
              description:
                "Browse dashboard-style metric views, charts, and project dashboards.",
            },
            navigation: {
              section: "Pages",
              label: "Dashboards",
              description: "Monitor projects and metrics",
              icon: "Grid",
            },
          }}
          element={<DashboardsRoot />}
          loader={dashboardsLoader}
          shouldRevalidate={revalidateOnPathChange}
        >
          <Route index element={<DashboardsEmptyPage />} />
          <Route
            path="projects/:projectId"
            element={<ProjectMetricsPage />}
            handle={{
              agentRoute: {
                label: "Project Dashboard",
                description:
                  "View project dashboard metrics, charts, and observability panels.",
              },
            }}
          />
        </Route>
        <Route
          path="/datasets"
          handle={{
            crumb: () => "Datasets",
            agentRoute: {
              label: "Datasets",
              description:
                "Browse the dataset list used for experiments, evaluations, and eval data.",
            },
            navigation: {
              section: "Pages",
              label: "Datasets & Experiments",
              description: "Curate data and run experiments",
              icon: "Database",
            },
          }}
        >
          <Route
            index
            element={<DatasetsPage />}
            handle={{
              agentRoute: {
                label: "Datasets",
                description:
                  "Browse the dataset list used for experiments, evaluations, and eval data.",
              },
            }}
          />
          <Route
            path=":datasetId"
            loader={datasetLoader}
            handle={{
              crumb: (data: DatasetLoaderData) => data?.dataset?.name,
              agentRoute: {
                label: "Dataset Experiments",
                description:
                  "View dataset experiments, experiment runs, and evaluation results.",
              },
              copy: (data: DatasetLoaderData) => [
                {
                  name: "Dataset Name",
                  value: data?.dataset?.name,
                  iconKey: "Text" as const,
                },
                {
                  name: "Dataset ID",
                  value: data?.dataset?.id,
                  iconKey: "ID" as const,
                },
              ],
            }}
          >
            <Route element={<DatasetPage />} loader={datasetLoader}>
              <Route index element={<ExperimentsPage />} />
              <Route
                path="experiments"
                element={<ExperimentsPage />}
                handle={{
                  agentRoute: {
                    label: "Dataset Experiments",
                    description:
                      "View dataset experiments, experiment runs, and evaluation results.",
                  },
                }}
              >
                <Route
                  path=":experimentId"
                  element={<ExperimentDetailPage />}
                  handle={{
                    agentRoute: {
                      label: "Experiment Details",
                      description:
                        "Inspect a single experiment, experiment run, and run details.",
                    },
                  }}
                />
              </Route>
              <Route
                path="examples"
                element={<ExamplesPage />}
                loader={examplesLoader}
                handle={{
                  agentRoute: {
                    label: "Dataset Examples",
                    description:
                      "Browse dataset examples, rows, and example records.",
                  },
                }}
              >
                <Route path=":exampleId" element={<ExamplePage />} />
              </Route>
              <Route
                path="versions"
                element={<DatasetVersionsPage />}
                loader={datasetVersionsLoader}
                handle={{
                  agentRoute: {
                    label: "Dataset Versions",
                    description:
                      "View dataset versions, dataset history, and version records.",
                  },
                }}
              />
              <Route
                path="metrics"
                element={<DatasetMetricsPage />}
                handle={{
                  agentRoute: {
                    label: "Dataset Experiment Metrics",
                    description:
                      "View annotation scores, run latency, cost, token usage, and error rate charts across a dataset's recent experiments.",
                  },
                }}
              />
              <Route
                path="evaluators"
                element={<DatasetEvaluatorsPage />}
                loader={datasetEvaluatorsLoader}
                handle={{
                  crumb: () => "evaluators",
                  agentRoute: {
                    label: "Dataset Evaluators",
                    description:
                      "View dataset evaluators, evals, and evaluation configuration attached to a dataset.",
                  },
                }}
              />
            </Route>
            <Route
              path="evaluators"
              handle={{
                crumb: () => "evaluators",
                agentRoute: {
                  label: "Dataset Evaluators",
                  description:
                    "View dataset evaluators, evals, and evaluation configuration attached to a dataset.",
                },
              }}
            >
              <Route
                id={EVALUATOR_DETAILS_ROUTE_ID}
                path=":evaluatorId"
                element={<DatasetEvaluatorDetailsPage />}
                loader={datasetEvaluatorDetailsLoader}
                handle={{
                  crumb: (data: DatasetEvaluatorDetailsLoaderData) =>
                    data?.evaluatorDisplayName || "evaluator",
                  agentRoute: {
                    label: "Dataset Evaluator Details",
                    description:
                      "Inspect dataset evaluator details, evaluator configuration, and eval traces. The evaluatorId route param uses the GraphQL DatasetEvaluator.id, not the nested Evaluator.id.",
                  },
                }}
              >
                <Route
                  path=":traceId"
                  element={<EvaluatorTracePage />}
                  handle={{
                    agentRoute: {
                      label: "Evaluator Trace",
                      description:
                        "Inspect an evaluator trace, eval trace, and trace details associated with a dataset evaluator. The traceId route param uses the GraphQL Trace.traceId OpenTelemetry trace ID, not Trace.id. Supports selecting a span with selectedSpanNodeId.",
                    },
                  }}
                />
              </Route>
            </Route>
            <Route
              path="compare"
              element={<ExperimentComparePage />}
              handle={{
                crumb: () => "compare",
                agentRoute: {
                  label: "Compare Experiments",
                  description:
                    "Compare experiment results, runs, and evaluation metrics for a dataset.",
                },
              }}
            />
          </Route>
        </Route>
        <Route
          path="/playground"
          handle={{
            crumb: () => "Playground", // TODO: add playground name
            agentRoute: {
              label: "Playground",
              description:
                "Experiment in the prompt playground with prompts, models, variables, and prompt runs. Supports experimentId, datasetId, splitId, exampleId, promptId, promptVersionId, promptTagName, and selectedSpanNodeId query params.",
            },
            navigation: {
              section: "Pages",
              label: "Playground",
              description: "Experiment with prompts and models",
              icon: "PlayCircle",
            },
          }}
        >
          <Route
            index
            element={<PlaygroundPage />}
            loader={playgroundPageLoader}
            handle={{
              agentRoute: {
                label: "Playground",
                description:
                  "Experiment in the prompt playground with prompts, models, variables, and prompt runs. Supports experimentId, datasetId, splitId, exampleId, promptId, promptVersionId, promptTagName, and selectedSpanNodeId query params.",
              },
            }}
          />
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
              agentRoute: {
                label: "Span Playground",
                description:
                  "Open a span in the prompt playground for span replay, prompt testing, and prompt experimentation. The spanId route param uses the GraphQL Span.id Relay node ID, not Span.spanId.",
              },
            }}
          />
        </Route>
        <Route
          path="/evaluators"
          handle={{
            crumb: () => "Evaluators",
            agentRoute: {
              label: "Evaluators",
              description:
                "Browse and manage evaluators, evals, and evaluation metrics.",
            },
            navigation: {
              section: "Pages",
              label: "Evaluators",
              description: "Evaluate application output",
              icon: "Scale",
            },
          }}
        >
          <Route
            index
            element={<EvaluatorsPage />}
            loader={evaluatorsPageLoader}
            handle={{
              agentRoute: {
                label: "Evaluators",
                description:
                  "Browse and manage evaluators, evals, and evaluation metrics.",
              },
            }}
          />
        </Route>
        <Route
          path="/prompts"
          handle={{
            crumb: () => "Prompts",
            agentRoute: {
              label: "Prompts",
              description:
                "Browse the prompt registry, saved prompts, and prompt versions.",
            },
            navigation: {
              section: "Pages",
              label: "Prompts",
              description: "Manage and version prompts",
              icon: "MessageSquare",
            },
          }}
        >
          <Route
            index
            element={<PromptsPage />}
            loader={promptsLoader}
            handle={{
              agentRoute: {
                label: "Prompts",
                description:
                  "Browse the prompt registry, saved prompts, and prompt versions.",
              },
            }}
          />
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
              agentRoute: {
                label: "Prompt Details",
                description:
                  "View prompt details for a saved prompt, prompt versions, and prompt history.",
              },
              copy: (data: PromptLoaderData) => {
                if (data?.prompt?.__typename === "Prompt") {
                  return [
                    {
                      name: "Prompt Name",
                      value: data.prompt.name,
                      iconKey: "Text" as const,
                    },
                    {
                      name: "Prompt ID",
                      value: data.prompt.id,
                      iconKey: "ID" as const,
                    },
                  ];
                }
                return [];
              },
            }}
          >
            <Route element={<PromptLayout />}>
              <Route index element={<PromptIndexPage />} />
              <Route
                path="versions"
                loader={promptVersionsLoader}
                element={<PromptVersionsPage />}
                handle={{
                  agentRoute: {
                    label: "Prompt Versions",
                    description:
                      "Browse prompt versions, prompt history, and saved prompt revisions.",
                  },
                }}
              >
                <Route
                  path=":versionId"
                  loader={promptVersionLoader}
                  element={<PromptVersionDetailsPage />}
                  handle={{
                    agentRoute: {
                      label: "Prompt Version Details",
                      description:
                        "Inspect a specific prompt version, revision, and prompt history entry.",
                    },
                  }}
                />
              </Route>
              <Route
                path="config"
                element={<PromptConfigPage />}
                loader={promptConfigLoader}
                handle={{
                  agentRoute: {
                    label: "Prompt Configuration",
                    description:
                      "Configure a saved prompt, prompt settings, labels, and prompt metadata.",
                  },
                }}
              />
            </Route>
          </Route>
        </Route>
        <Route
          path="/apis/rest"
          element={<RestAPIPage />}
          handle={{
            crumb: () => "REST API",
            agentRoute: {
              label: "REST API",
              description:
                "Open the Phoenix REST API reference, API docs, and OpenAPI documentation.",
            },
            navigation: {
              section: "Pages",
              label: "REST API",
              description: "REST API reference",
              icon: "Code",
            },
          }}
        />
        <Route
          path="/apis/graphql"
          element={<GraphQLPage />}
          handle={{
            crumb: () => "GraphQL",
            agentRoute: {
              label: "GraphQL",
              description:
                "Open the Phoenix GraphQL API explorer and GraphQL schema browser.",
            },
            navigation: {
              section: "Pages",
              label: "GraphQL",
              description: "GraphQL API explorer",
              icon: "GraphQL",
            },
          }}
        />
        <Route
          path="/support"
          element={<SupportPage />}
          handle={{
            crumb: () => "Support",
            agentRoute: {
              label: "Support",
              description:
                "Find Phoenix support resources, help, contact support, and troubleshooting links.",
            },
          }}
        />
        <Route
          path="/settings"
          element={<SettingsPage />}
          handle={{
            crumb: () => "Settings",
            agentRoute: {
              label: "Settings",
              description:
                "Open Phoenix instance settings, configuration, and admin settings.",
            },
          }}
        >
          <Route
            path="general"
            loader={settingsGeneralPageLoader}
            element={<SettingsGeneralPage />}
            handle={{
              crumb: () => "General",
              agentRoute: {
                label: "General Settings",
                description:
                  "Configure general Phoenix instance settings including hostname, platform version, database usage, and the default project retention policy.",
              },
              navigation: {
                section: "Pages",
                label: "Settings",
                description: "Platform configuration",
                icon: "Options",
              },
            }}
          />
          <Route
            path="users"
            element={<SettingsUsersPage />}
            handle={{
              crumb: () => "Users",
              agentRoute: {
                label: "Users",
                description:
                  "Manage users and members: add or invite a user, change a user's role, reset a password, or delete a user.",
              },
            }}
          >
            <Route path=":userId" element={<UserDetailsDrawer />} />
          </Route>
          <Route
            path="api-keys"
            element={<SettingsAPIKeysPage />}
            handle={{
              crumb: () => "API Keys",
              agentRoute: {
                label: "API Keys",
                description:
                  "Manage API keys: create system API keys and view or revoke system and user API keys for programmatic access.",
              },
            }}
          />
          <Route
            path="mcp"
            element={<SettingsMCPPage />}
            handle={{
              crumb: () => "MCP",
              agentRoute: {
                label: "MCP",
                description:
                  "Set up the Model Context Protocol (MCP) server: copy the MCP endpoint URL and follow setup instructions to connect coding agents and MCP clients like Claude Code, Claude Desktop, Cursor, VS Code, and Codex.",
              },
            }}
          />
          <Route
            path="secrets"
            loader={settingsSecretsPageLoader}
            element={<SettingsSecretsPage />}
            handle={{
              crumb: () => "Secrets",
              agentRoute: {
                label: "Secrets",
                description:
                  "Manage write-only secrets used by Phoenix integrations, custom providers, sandboxes, and tools.",
              },
            }}
          />
          <Route
            path="providers"
            loader={settingsAIProvidersPageLoader}
            element={<SettingsAIProvidersPage />}
            handle={{
              crumb: () => "AI Providers",
              agentRoute: {
                label: "AI Providers",
                description:
                  "Configure AI providers, custom providers, provider credentials, base URLs, default model, and provider headers.",
              },
            }}
          />
          <Route
            path="sandboxes"
            loader={settingsSandboxesPageLoader}
            element={<SettingsSandboxesPage />}
            handle={{
              crumb: () => "Sandboxes",
              agentRoute: {
                label: "Sandboxes",
                description:
                  "Configure sandbox providers and sandbox configurations for code execution, dependencies, environment variables, internet access, and timeouts.",
              },
            }}
          />
          <Route
            path="models"
            loader={settingsModelsLoader}
            element={<SettingsModelsPage />}
            handle={{
              crumb: () => "Models",
              agentRoute: {
                label: "Models",
                description:
                  "Configure saved model settings including provider, model name patterns, start dates, and token pricing.",
              },
            }}
          />
          <Route
            path="datasets"
            element={<SettingsDatasetsPage />}
            handle={{
              crumb: () => "Datasets",
              agentRoute: {
                label: "Dataset Settings",
                description:
                  "Configure dataset labels, dataset settings, and labeling options.",
              },
            }}
          />
          <Route
            path="annotations"
            loader={settingsAnnotationsPageLoader}
            element={<SettingsAnnotationsPage />}
            handle={{
              crumb: () => "Annotations",
              agentRoute: {
                label: "Annotations",
                description:
                  "Configure annotation configs including categorical, continuous, and freeform annotation settings.",
              },
            }}
          />
          <Route
            path="data"
            element={<SettingsDataPage />}
            handle={{
              crumb: () => "Data Retention",
              agentRoute: {
                label: "Data Retention",
                description:
                  "Manage trace retention policies, including policy names, schedules, maximum days, maximum trace counts, and assigned projects.",
              },
            }}
            loader={settingsDataPageLoader}
          />
          <Route
            path="prompts"
            element={<SettingsPromptsPage />}
            loader={settingsPromptsPageLoader}
            handle={{
              crumb: () => "Prompts",
              agentRoute: {
                label: "Prompt Settings",
                description:
                  "Configure prompt labels, prompt settings, and saved prompt labeling options.",
              },
            }}
          />
          <Route
            path="agents"
            element={<SettingsAgentsPage />}
            loader={settingsAgentsPageLoader}
            handle={{
              crumb: () => "Agents",
              agentRoute: {
                label: "Agent Settings",
                description:
                  "Configure the assistant, PXI enablement, agent model, edit approvals, experiment flags, trace collection, and manage saved assistant sessions.",
              },
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
        <Route
          path="/redirects/projects/:project_name"
          loader={projectRedirectLoader}
          errorElement={<ErrorElement />}
        />
        <Route
          path="/redirects/prompts/:promptId/tags/:tagName"
          loader={promptTagRedirectLoader}
          errorElement={<ErrorElement />}
        />
        <Route
          path="/redirects/datasets/:datasetId/examples/:externalId"
          loader={exampleRedirectLoader}
          errorElement={<ErrorElement />}
        />
      </Route>
    </Route>
  </Route>
);

registerRouteInfoCatalog({
  catalog: buildRouteInfoCatalog(appRouteObjects),
});
registerRouteNavigationCatalog({
  catalog: buildRouteNavigationCatalog(appRouteObjects),
});

const router = createBrowserRouter(appRouteObjects, {
  basename: window.Config.basename,
});

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
