import type { ConcreteRequest, GraphQLTaggedNode } from "relay-runtime";

import { PHOENIX_ROOT } from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";

import type { GeneratedContextFile } from "../types";

export const PHOENIX_GQL_GUIDE = `# phoenix-gql

Use \`phoenix-gql\` to execute read-only GraphQL queries against Phoenix from the bash sandbox.
This command is built into the bash environment; you can execute it directly.

Querying tips:
- Prefer \`node(id: ...)\` with inline fragments when page context already gives you an entity id.
- Use page context and any route-specific recipe files to find likely ids and entrypoints.
- Verify argument names and enum values in \`${PHOENIX_ROOT}/graphql/schema.json\` before guessing.
- Use \`--data-only\` when piping into \`jq\`.
- Use \`--output\` for larger results you want to inspect in multiple steps.

Examples:

\`\`\`bash
phoenix-gql '{ projects { edges { node { name } } } }' | jq '.data'
cat query.graphql | phoenix-gql --vars '{"id":"UHJvamVjdDox"}' --data-only
phoenix-gql query.graphql --vars-file vars.json | jq '.data'
phoenix-gql big-query.graphql --output /home/user/workspace/result.json
\`\`\`

Notes:
- Only GraphQL queries are permitted.
- Mutations and subscriptions are rejected.
- Large responses may spill to a workspace file unless you pass \`--stdout\`.
- The GraphQL schema introspection is available at \`${PHOENIX_ROOT}/graphql/schema.json\`.
`;

export function formatJsonBlock(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function getGraphqlRequestText(
  request: GraphQLTaggedNode,
  requestName: string
) {
  const text = (request as ConcreteRequest).params.text;

  if (!text) {
    throw new Error(
      `Relay request ${requestName} did not include printable text`
    );
  }

  return `${text}\n`;
}

export function createGraphqlContextFile({
  path,
  request,
  requestName,
}: {
  path: string;
  request: GraphQLTaggedNode;
  requestName: string;
}): GeneratedContextFile {
  return {
    path,
    content: getGraphqlRequestText(request, requestName),
  };
}

export function createJsonContextFile({
  path,
  value,
}: {
  path: string;
  value: unknown;
}): GeneratedContextFile {
  return {
    path,
    content: `${formatJsonBlock(value)}\n`,
  };
}
