/**
 * The instrumentation prompt handed to a coding agent.
 *
 * One shared template serves the launched-agent and copy-to-clipboard lanes.
 * Every rule is load-bearing — do not trim a rule without replacing the
 * protection it provides. The prompt leans
 * on the docs for package names and APIs (language-scoped quickstarts plus
 * the integrations index) rather than inlining instructions that go stale.
 * Setup independently verifies traces against the Phoenix API after the
 * agent finishes, so the agent's job ends with an emitted trace, not a
 * self-report.
 */

import { DOCS_MCP_SERVER_NAME } from "../agents/registry";

export interface InstrumentationPromptDocs {
  /** Python quickstart (arize-phoenix-otel). */
  quickstartPython: string;
  /** TypeScript quickstart (@arizeai/phoenix-otel). */
  quickstartTypeScript: string;
  /** phoenix.otel register() reference. */
  phoenixOtelSetup: string;
  /** Per-framework/provider auto-instrumentation guides. */
  integrationsIndex: string;
}

export interface InstrumentationPromptArgs {
  projectName: string;
  endpoint: string;
  isDefaultEndpoint: boolean;
  docs: InstrumentationPromptDocs;
  tracesUrl: string;
  authEnabled: boolean;
  /**
   * `--language` values. Non-empty replaces the agent's own language
   * detection, which is the slowest and least reliable thing it does.
   */
  languages?: string[];
  /**
   * Directory the docs prefetch wrote, when it ran. The agent reads those
   * pages from disk instead of fetching the URLs mid-run.
   */
  localDocsDir?: string;
  /**
   * True when the phoenix-docs MCP server was connected to the agent's
   * project config. The agent then searches the docs on demand — cheaper
   * than fetching whole pages — instead of reading a local prefetch.
   */
  docsMcpConfigured?: boolean;
}

export function buildInstrumentationPrompt({
  projectName,
  endpoint,
  isDefaultEndpoint,
  docs,
  tracesUrl,
  authEnabled,
  languages = [],
  localDocsDir,
  docsMcpConfigured,
}: InstrumentationPromptArgs): string {
  const credentialVars = authEnabled
    ? "PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY"
    : "PHOENIX_COLLECTOR_ENDPOINT";
  const endpointRule = isDefaultEndpoint
    ? ""
    : `\n   Also set the collector endpoint in code only if the quickstart says to; it is ${endpoint}.`;
  const languageRule =
    languages.length > 0
      ? `The app's language is ${languages.join(" and ")} — do not spend time detecting it.`
      : "Detect the app's language, follow the matching quickstart, and use the integration guide\nfor the app's LLM framework or provider.";
  const localDocsRule = localDocsDir
    ? `\nThese pages are already downloaded to ${localDocsDir} — read them from disk first, and only\nfetch a URL if the page you need is missing there.`
    : "";
  const docsMcpRule = docsMcpConfigured
    ? `\nThe "${DOCS_MCP_SERVER_NAME}" MCP server is connected in this project — search it for Phoenix docs\nfirst; it returns just the relevant sections. Fetch the URLs above only if its tools are\nunavailable.`
    : "";

  return `You are running as part of the Phoenix setup script. Your ONLY task is to add Phoenix
tracing to the application in the current working directory and emit one verification
trace. Do not run setup tools, onboarding scripts, or "px setup" again.

Work from the official docs — do not guess package names or APIs from memory:
- Python quickstart (arize-phoenix-otel): ${docs.quickstartPython}
- TypeScript quickstart (@arizeai/phoenix-otel): ${docs.quickstartTypeScript}
- register() reference: ${docs.phoenixOtelSetup}
- Auto-instrumentation guides by framework/provider: ${docs.integrationsIndex}${localDocsRule}${docsMcpRule}
${languageRule}

Rules:
1. Tracing only. Do not add evals, datasets, prompts, dashboards, or any other feature.
2. Credentials are provided via environment variables (${credentialVars}), which Phoenix SDKs read
   automatically. If they are not set in your shell, apply them with
   \`set -a; source .env.phoenix; set +a\` before the verification run. NEVER print the
   contents of \`.env.phoenix\`, never print the API key, and never
   write the API key or any secret into source code, config files, or command arguments.
3. Configure the Phoenix project name in code: use the SDK's register call with the
   project name "${projectName}".${endpointRule}
4. Prefer auto-instrumentation packages over hand-written span wrappers. Make the smallest
   correct change.
5. Verify your work by emitting exactly one trace: run the app briefly, or a minimal
   throwaway script that makes one real LLM call through the instrumented path, then
   delete any throwaway script. Do not run the full test suite or the build.
6. Install SDK packages with the project's existing package manager, pinned to the latest
   stable version you can verify. If this is a monorepo, note the root but only modify
   files at or below the current working directory.
7. Keep changes concise and readable. Do not restructure, reformat, or meaningfully modify
   existing application code.
8. Do not use the \`px\` CLI.

When finished, end your final message with a one-line summary of the changes you made and
this link to the project's traces: ${tracesUrl}
If you could not complete the task or could not emit a verification trace, say so plainly
with a one-paragraph reason instead.
`;
}
