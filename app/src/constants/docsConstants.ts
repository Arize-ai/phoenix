const PHOENIX_DOCS_ROOT = "https://arize.com/docs/phoenix";

/**
 * Phoenix documentation links used by the application UI.
 *
 * Keep documentation URLs in this registry so they can be audited and checked
 * for broken links in CI without searching through component source files.
 */
export const PHOENIX_DOCUMENTATION_LINKS = {
  accessControl: `${PHOENIX_DOCS_ROOT}/settings/access-control-rbac`,
  annotationConfigs: `${PHOENIX_DOCS_ROOT}/tracing/how-to-tracing/feedback-and-annotations/annotating-in-the-ui`,
  apiKeys: `${PHOENIX_DOCS_ROOT}/settings/api-keys`,
  customAiProviders: `${PHOENIX_DOCS_ROOT}/settings/custom-ai-providers`,
  dataRetention: `${PHOENIX_DOCS_ROOT}/settings/data-retention`,
  datasetLabels: `${PHOENIX_DOCS_ROOT}/release-notes/10-2025/10-08-2025-dataset-labels`,
  modelCostTracking: `${PHOENIX_DOCS_ROOT}/tracing/how-to-tracing/cost-tracking`,
  phoenixMcpServer: `${PHOENIX_DOCS_ROOT}/integrations/phoenix-mcp-server`,
  promptLabels: `${PHOENIX_DOCS_ROOT}/release-notes/09-2025/09-15-2025-prompt-labels`,
  providers: `${PHOENIX_DOCS_ROOT}/prompt-engineering/how-to-prompts/configure-ai-providers`,
  pxi: `${PHOENIX_DOCS_ROOT}/pxi`,
  sandboxes: `${PHOENIX_DOCS_ROOT}/settings/sandboxes`,
  secrets: `${PHOENIX_DOCS_ROOT}/settings/secrets`,
} as const;
