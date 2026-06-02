import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  type ShouldRevalidateFunction,
} from "react-router";
import { RouterProvider } from "react-router/dom";

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
import { SettingsAIProvidersPage } from "@phoenix/pages/settings/SettingsAIProvidersPage";
import { settingsAIProvidersPageLoader } from "@phoenix/pages/settings/settingsAIProvidersPageLoader";
import { SettingsAnnotationsPage } from "@phoenix/pages/settings/SettingsAnnotationsPage";
import { settingsAnnotationsPageLoader } from "@phoenix/pages/settings/settingsAnnotationsPageLoader";
import { SettingsDataPage } from "@phoenix/pages/settings/SettingsDataPage";
import { SettingsGeneralPage } from "@phoenix/pages/settings/SettingsGeneralPage";
import { settingsModelsLoader } from "@phoenix/pages/settings/settingsModelsLoader";
import { SettingsModelsPage } from "@phoenix/pages/settings/SettingsModelsPage";
import { SettingsSandboxesPage } from "@phoenix/pages/settings/SettingsSandboxesPage";
import { settingsSandboxesPageLoader } from "@phoenix/pages/settings/settingsSandboxesPageLoader";

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
  PlaygroundPage,
  playgroundPageLoader,
  ProfilePage,
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
            crumb: () => "profile",
            agentRoute: {
              label: "Profile",
              description:
                "Manage the current user's profile, API keys, password, and display preferences including timezone and code snippet defaults.",
              keywords: [
                "profile",
                "user profile",
                "account",
                "personal api keys",
                "user api keys",
                "reset password",
                "change password",
                "timezone",
                "time zone",
                "display timezone",
                "timestamp timezone",
                "theme",
                "dark mode",
                "code snippets",
                "package manager",
              ],
            },
          }}
          element={<ProfilePage />}
        />
        <Route index loader={homeLoader} />
        <Route
          path="/projects"
          handle={{
            crumb: () => "Projects",
            agentRoute: {
              label: "Projects",
              description:
                "Browse Phoenix projects and open project-specific observability views.",
              keywords: ["projects", "project list", "observability projects"],
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
                description: "Open a project's default overview page.",
                keywords: ["project", "project overview", "project home"],
              },
              copy: (data: ProjectLoaderData) => [
                {
                  name: "Project Name",
                  value: data?.project?.name,
                  iconKey: "TextOutline" as const,
                },
                {
                  name: "Project ID",
                  value: data?.project?.id,
                  iconKey: "IDOutline" as const,
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
                    description: "Inspect traces for a project.",
                    keywords: ["traces", "project traces", "trace table"],
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
                        "Inspect the spans and details for a single trace.",
                      keywords: ["trace details", "trace view", "span tree"],
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
                    description: "Inspect and filter spans for a project.",
                    keywords: [
                      "spans",
                      "project spans",
                      "span table",
                      "span filter",
                    ],
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
                        "Inspect the spans and details for a single trace.",
                      keywords: ["trace details", "trace view", "span tree"],
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
                      "Browse user or application sessions for a project.",
                    keywords: ["sessions", "project sessions", "session list"],
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
                        "Inspect the traces and turns for a single session.",
                      keywords: [
                        "session details",
                        "session trace",
                        "session turns",
                      ],
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
                    keywords: [
                      "project config",
                      "project settings",
                      "project name",
                      "project description",
                      "default project tab",
                      "default tab",
                      "data retention",
                      "project retention policy",
                      "assign retention policy",
                    ],
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
                      "View time-series metrics and observability charts for a project.",
                    keywords: [
                      "metrics",
                      "project metrics",
                      "charts",
                      "dashboard",
                    ],
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
              description: "Browse dashboard-style project metric views.",
              keywords: ["dashboards", "metrics dashboards", "charts"],
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
                description: "View dashboard metrics for a project.",
                keywords: ["project dashboard", "project metrics", "charts"],
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
                "Browse datasets used for experiments and evaluations.",
              keywords: ["datasets", "dataset list", "experiments data"],
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
                  "Browse datasets used for experiments and evaluations.",
                keywords: ["datasets", "dataset list", "experiments data"],
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
                description: "View experiments for a dataset.",
                keywords: ["dataset", "dataset experiments", "experiments"],
              },
              copy: (data: DatasetLoaderData) => [
                {
                  name: "Dataset Name",
                  value: data?.dataset?.name,
                  iconKey: "TextOutline" as const,
                },
                {
                  name: "Dataset ID",
                  value: data?.dataset?.id,
                  iconKey: "IDOutline" as const,
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
                    description: "View experiments for a dataset.",
                    keywords: ["dataset experiments", "experiments", "runs"],
                  },
                }}
              >
                <Route
                  path=":experimentId"
                  element={<ExperimentDetailPage />}
                  handle={{
                    agentRoute: {
                      label: "Experiment Details",
                      description: "Inspect a single experiment and its runs.",
                      keywords: [
                        "experiment details",
                        "experiment runs",
                        "runs",
                      ],
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
                    description: "Browse examples for a dataset.",
                    keywords: ["dataset examples", "examples", "dataset rows"],
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
                    description: "View dataset versions.",
                    keywords: ["dataset versions", "versions"],
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
                    description: "View evaluators attached to a dataset.",
                    keywords: ["dataset evaluators", "evaluators", "evals"],
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
                  description: "View evaluators attached to a dataset.",
                  keywords: ["dataset evaluators", "evaluators", "evals"],
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
                    description: "Inspect evaluator configuration and traces.",
                    keywords: [
                      "evaluator details",
                      "dataset evaluator",
                      "eval traces",
                    ],
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
                        "Inspect a trace associated with a dataset evaluator.",
                      keywords: [
                        "evaluator trace",
                        "eval trace",
                        "trace details",
                      ],
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
                  description: "Compare experiment results for a dataset.",
                  keywords: [
                    "compare experiments",
                    "experiment comparison",
                    "compare runs",
                  ],
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
                "Experiment with prompts, models, variables, and prompt runs.",
              keywords: [
                "playground",
                "prompt playground",
                "prompt testing",
                "models",
              ],
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
                  "Experiment with prompts, models, variables, and prompt runs.",
                keywords: [
                  "playground",
                  "prompt playground",
                  "prompt testing",
                  "models",
                ],
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
                  "Open a span in the playground for prompt experimentation.",
                keywords: [
                  "span playground",
                  "playground span",
                  "prompt from span",
                ],
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
              description: "Browse and manage evaluators.",
              keywords: ["evaluators", "evals", "evaluation"],
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
                description: "Browse and manage evaluators.",
                keywords: ["evaluators", "evals", "evaluation"],
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
              description: "Browse saved prompts and prompt versions.",
              keywords: ["prompts", "prompt registry", "saved prompts"],
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
                description: "Browse saved prompts and prompt versions.",
                keywords: ["prompts", "prompt registry", "saved prompts"],
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
                description: "View a saved prompt and its versions.",
                keywords: ["prompt details", "saved prompt", "prompt versions"],
              },
              copy: (data: PromptLoaderData) => {
                if (data?.prompt?.__typename === "Prompt") {
                  return [
                    {
                      name: "Prompt Name",
                      value: data.prompt.name,
                      iconKey: "TextOutline" as const,
                    },
                    {
                      name: "Prompt ID",
                      value: data.prompt.id,
                      iconKey: "IDOutline" as const,
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
                    description: "Browse versions for a saved prompt.",
                    keywords: ["prompt versions", "versions", "prompt history"],
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
                      description: "Inspect a specific prompt version.",
                      keywords: [
                        "prompt version details",
                        "prompt version",
                        "version details",
                      ],
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
                    description: "Configure a saved prompt.",
                    keywords: [
                      "prompt config",
                      "prompt settings",
                      "configure prompt",
                    ],
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
              description: "Open the Phoenix REST API reference.",
              keywords: ["rest api", "api docs", "openapi"],
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
              description: "Open the Phoenix GraphQL explorer.",
              keywords: ["graphql", "graphql api", "graphql explorer"],
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
              description: "Find Phoenix support resources.",
              keywords: ["support", "help", "contact support"],
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
              description: "Open Phoenix instance settings.",
              keywords: ["settings", "configuration", "admin settings"],
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
                  "Configure general Phoenix instance settings including hostname, platform version, database usage, users, system API keys, and the default project retention policy.",
                keywords: [
                  "general settings",
                  "settings",
                  "instance settings",
                  "hostname",
                  "platform version",
                  "server version",
                  "database usage",
                  "storage usage",
                  "users",
                  "user management",
                  "system api keys",
                  "api keys",
                  "default retention policy",
                  "default project retention policy",
                  "maximum trace retention",
                  "trace retention days",
                ],
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
                keywords: [
                  "secrets",
                  "secret values",
                  "api keys",
                  "credentials",
                  "environment variables",
                  "provider secrets",
                  "sandbox secrets",
                  "tokens",
                ],
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
                keywords: [
                  "ai providers",
                  "model providers",
                  "provider credentials",
                  "custom provider",
                  "custom ai provider",
                  "openai",
                  "azure openai",
                  "anthropic",
                  "aws bedrock",
                  "google genai",
                  "api key",
                  "base url",
                  "default model",
                  "provider headers",
                ],
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
                keywords: [
                  "sandboxes",
                  "sandbox settings",
                  "sandbox providers",
                  "sandbox configurations",
                  "code execution",
                  "code interpreter",
                  "dependencies",
                  "environment variables",
                  "internet access",
                  "timeout",
                ],
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
                keywords: [
                  "models",
                  "model settings",
                  "saved models",
                  "model name",
                  "model pattern",
                  "name pattern",
                  "token prices",
                  "token pricing",
                  "cost per million tokens",
                  "prompt tokens",
                  "completion tokens",
                  "custom models",
                  "built-in models",
                ],
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
                description: "Configure dataset labels and dataset settings.",
                keywords: [
                  "dataset settings",
                  "datasets",
                  "settings datasets",
                  "dataset labels",
                  "labels",
                  "new dataset label",
                ],
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
                keywords: [
                  "annotations",
                  "annotation configs",
                  "annotation settings",
                  "categorical annotations",
                  "continuous annotations",
                  "freeform annotations",
                  "annotation labels",
                  "annotation scores",
                  "optimization direction",
                ],
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
                keywords: [
                  "data retention",
                  "data retention policy settings",
                  "retention policies",
                  "retention policy",
                  "retention policy configuration",
                  "all retention policies",
                  "new retention policy",
                  "create retention policy",
                  "edit retention policy",
                  "trace retention",
                  "maximum trace retention",
                  "number of days",
                  "number of traces",
                  "retention schedule",
                  "assigned projects",
                  "purge traces",
                  "delete old traces",
                  "storage retention",
                ],
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
                description: "Configure prompt labels and prompt settings.",
                keywords: [
                  "prompt settings",
                  "prompts",
                  "settings prompts",
                  "prompt labels",
                  "labels",
                  "new prompt label",
                ],
              },
            }}
          />
          <Route
            path="agents"
            element={<SettingsAgentsPage />}
            handle={{
              crumb: () => "Agents",
              agentRoute: {
                label: "Agent Settings",
                description:
                  "Configure the assistant, PXI enablement, agent model, edit approvals, experiment flags, and assistant trace collection.",
                keywords: [
                  "agent settings",
                  "assistant settings",
                  "agents",
                  "pxi settings",
                  "pxi",
                  "assistant",
                  "agent model",
                  "edit approvals",
                  "tool approvals",
                  "experimental agent settings",
                  "assistant traces",
                  "trace sharing",
                  "collector endpoint",
                  "assistant project name",
                ],
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

const router = createBrowserRouter(appRouteObjects, {
  basename: window.Config.basename,
});

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
