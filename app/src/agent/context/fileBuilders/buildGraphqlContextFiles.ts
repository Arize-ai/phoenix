import { PHOENIX_ROOT } from "@phoenix/agent/context/filesystem";
import type { AgentPageContext } from "@phoenix/agent/context/pageContextTypes";

import phoenixGraphqlSchema from "../../../../schema.graphql?raw";
import {
  buildDatasetRecipeFiles,
  buildDatasetStarterFiles,
} from "./graphql/dataset";
import {
  buildAgentStartGuide,
  buildCurrentPageGuide,
} from "./graphql/pageDocs";
import {
  buildProjectRecipeFiles,
  buildProjectStarterFiles,
} from "./graphql/project";
import {
  buildPromptRecipeFiles,
  buildPromptStarterFiles,
} from "./graphql/prompt";
import { PHOENIX_GQL_GUIDE } from "./graphql/shared";
import { buildTraceRecipeFiles, buildTraceStarterFiles } from "./graphql/trace";
import type { GeneratedContextFile } from "./types";

function buildFallbackStarterFiles(): GeneratedContextFile[] {
  return [
    {
      path: `${PHOENIX_ROOT}/graphql/examples/discover-root-fields.sh`,
      content: `grep -n '^type Query' -A 120 /phoenix/graphql/schema.graphql
`,
    },
  ];
}

function buildStarterFiles(
  pageContext: AgentPageContext
): GeneratedContextFile[] {
  const { projectId, traceId, datasetId, promptId } = pageContext.params;

  if (projectId && traceId) {
    return buildTraceStarterFiles(projectId, traceId);
  }

  if (projectId) {
    return buildProjectStarterFiles(projectId);
  }

  if (datasetId) {
    return buildDatasetStarterFiles(datasetId);
  }

  if (promptId) {
    return buildPromptStarterFiles(promptId);
  }

  return buildFallbackStarterFiles();
}

function buildRecipeFiles(
  pageContext: AgentPageContext
): GeneratedContextFile[] {
  const { projectId, traceId, datasetId, promptId } = pageContext.params;

  if (projectId && traceId) {
    return buildTraceRecipeFiles({ projectId, traceId });
  }

  if (projectId) {
    return buildProjectRecipeFiles(pageContext);
  }

  if (datasetId) {
    return buildDatasetRecipeFiles(datasetId);
  }

  if (promptId) {
    return buildPromptRecipeFiles(promptId);
  }

  return [];
}

export function buildGraphqlContextFiles(pageContext: AgentPageContext) {
  const starterFiles = buildStarterFiles(pageContext);
  const recipeFiles = buildRecipeFiles(pageContext);
  const recipePaths = recipeFiles.map((file) => file.path);

  return Object.fromEntries([
    [
      `${PHOENIX_ROOT}/agent-start.md`,
      buildAgentStartGuide({ pageContext, recipePaths }),
    ],
    [`${PHOENIX_ROOT}/graphql/schema.graphql`, phoenixGraphqlSchema],
    [`${PHOENIX_ROOT}/graphql/README.md`, PHOENIX_GQL_GUIDE],
    [
      `${PHOENIX_ROOT}/graphql/current-page.md`,
      buildCurrentPageGuide({ pageContext, recipePaths }),
    ],
    ...starterFiles.map((file) => [file.path, file.content]),
    ...recipeFiles.map((file) => [file.path, file.content]),
  ]);
}
