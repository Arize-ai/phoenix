import { PHOENIX_ROOT } from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";
import type { AgentPageContext } from "@phoenix/agent/tools/bash/context/pageContextTypes";
import { authFetch } from "@phoenix/authFetch";
import { BASE_URL } from "@phoenix/config";

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

const INTROSPECTION_QUERY = `{
  __schema {
    queryType { name }
    mutationType { name }
    types {
      kind name description
      fields(includeDeprecated: false) {
        name description
        args { name description type { ...TypeRef } defaultValue }
        type { ...TypeRef }
      }
      inputFields {
        name description type { ...TypeRef } defaultValue
      }
      enumValues(includeDeprecated: false) { name description }
      possibleTypes { name }
    }
  }
}

fragment TypeRef on __Type {
  kind name
  ofType {
    kind name
    ofType {
      kind name
      ofType {
        kind name
        ofType { kind name }
      }
    }
  }
}`;

async function fetchSchemaIntrospection(): Promise<string | null> {
  try {
    const response = await authFetch(`${BASE_URL}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: INTROSPECTION_QUERY }),
    });

    if (!(response instanceof Response) || !response.ok) {
      return null;
    }

    const payload = (await response.json()) as { data?: unknown };
    return payload.data ? JSON.stringify(payload.data, null, 2) : null;
  } catch {
    return null;
  }
}

function buildFallbackStarterFiles(): GeneratedContextFile[] {
  return [
    {
      path: `${PHOENIX_ROOT}/graphql/examples/discover-root-fields.sh`,
      content: `phoenix-gql '{ __schema { queryType { name } types { name kind fields { name } } } }' --data-only | jq '..__schema.types[] | select(.kind == "OBJECT" and .name == "Query") | .fields[].name'
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

export async function buildGraphqlContextFiles(pageContext: AgentPageContext) {
  const starterFiles = buildStarterFiles(pageContext);
  const recipeFiles = buildRecipeFiles(pageContext);
  const recipePaths = recipeFiles.map((file) => file.path);
  const schema = await fetchSchemaIntrospection();

  const entries: Array<[string, string]> = [
    [
      `${PHOENIX_ROOT}/agent-start.md`,
      buildAgentStartGuide({ pageContext, recipePaths }),
    ],
    [`${PHOENIX_ROOT}/graphql/README.md`, PHOENIX_GQL_GUIDE],
    [
      `${PHOENIX_ROOT}/graphql/current-page.md`,
      buildCurrentPageGuide({ pageContext, recipePaths }),
    ],
    ...starterFiles.map((file): [string, string] => [file.path, file.content]),
    ...recipeFiles.map((file): [string, string] => [file.path, file.content]),
  ];

  if (schema) {
    entries.push([`${PHOENIX_ROOT}/graphql/schema.json`, schema]);
  }

  return Object.fromEntries(entries);
}
