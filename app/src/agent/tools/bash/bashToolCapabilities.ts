import {
  BASH_TOOL_READONLY_ROOT,
  BASH_TOOL_WORKSPACE_ROOT,
} from "./bashToolFilesystemPolicy";

export const BASH_TOOL_CAPABILITY_LINES = [
  "Runs inside a browser-only just-bash virtual shell, not a host machine or container.",
  `Read Phoenix context from ${BASH_TOOL_READONLY_ROOT}; writes there are blocked.`,
  `Write scratch files only under ${BASH_TOOL_WORKSPACE_ROOT}; mutations elsewhere are blocked.`,
  "General purpose network access is disabled, so curl/wget and remote package installs should not be assumed to work.",
  "Built-in just-bash commands are available; do not assume apt, brew, pnpm, uv, git, or other host binaries exist unless the sandbox reports them.",
  "The user has no access to the filesystem. You can use the filesystem for your own purposes, but if you want to share something with the user, you must display the content in the rich markdown rendered chat.",
  "phoenix-gql is available for GraphQL queries against the Phoenix graphQL API. Inspect the help text for usage tips when the user requests phoenix data.",
] as const;

export const BASH_TOOL_SYSTEM_PROMPT_LINES = [
  "When the bash tool is available, respect these sandbox constraints:",
  ...BASH_TOOL_CAPABILITY_LINES.map((line) => `- ${line}`),
  `The ${BASH_TOOL_READONLY_ROOT} directory contains the current page context and may be refreshed on navigation, time-range changes, or a /refresh command.`,
  `To orient to the current page, first read ${BASH_TOOL_READONLY_ROOT}/agent-start.md. Use other files in ${BASH_TOOL_READONLY_ROOT} as needed.`,
] as const;

export const BASH_TOOL_CAPABILITY_DESCRIPTION =
  BASH_TOOL_CAPABILITY_LINES.join(" ");
