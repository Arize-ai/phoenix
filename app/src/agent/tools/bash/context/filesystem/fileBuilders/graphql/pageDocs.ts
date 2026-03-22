import { PHOENIX_ROOT } from "@phoenix/agent/tools/bash/context/filesystem/pathConstants";
import type { AgentPageContext } from "@phoenix/agent/tools/bash/context/pageContextTypes";

import { formatJsonBlock } from "./shared";

export function buildCurrentPageGuide({
  pageContext,
  recipePaths,
}: {
  pageContext: AgentPageContext;
  recipePaths: string[];
}) {
  return `# Current Page Query Hints

Current route:
- pathname: ${pageContext.pathname}
- params: ${formatJsonBlock(pageContext.params)}

Available recipes:
${recipePaths.length > 0 ? recipePaths.map((path) => `- ${path}`).join("\n") : "- (none)"}
`;
}

export function buildAgentStartGuide({
  pageContext,
  recipePaths,
}: {
  pageContext: AgentPageContext;
  recipePaths: string[];
}) {
  return `# Agent Start

Use this file for initial orientation.

- pathname: ${pageContext.pathname}
- params: ${formatJsonBlock(pageContext.params)}
- search params: ${formatJsonBlock(pageContext.searchParams)}

Helpful files:
- ${PHOENIX_ROOT}/page-context.json
- ${PHOENIX_ROOT}/graphql/current-page.md
- ${PHOENIX_ROOT}/graphql/README.md

Relevant recipe files:
${recipePaths.length > 0 ? recipePaths.map((path) => `- ${path}`).join("\n") : "- (none)"}
`;
}
