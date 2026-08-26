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
  remoteMcpServer: `${PHOENIX_DOCS_ROOT}/integrations/remote-mcp`,
  promptLabels: `${PHOENIX_DOCS_ROOT}/release-notes/09-2025/09-15-2025-prompt-labels`,
  providers: `${PHOENIX_DOCS_ROOT}/prompt-engineering/how-to-prompts/configure-ai-providers`,
  pxi: `${PHOENIX_DOCS_ROOT}/pxi`,
  sandboxes: `${PHOENIX_DOCS_ROOT}/settings/sandboxes`,
  secrets: `${PHOENIX_DOCS_ROOT}/settings/secrets`,
} as const;

type DocumentationTopicDefinition = {
  href: string;
  label: string;
};

/**
 * Documentation topics exposed by the shared documentation help component.
 *
 * Each topic owns its accessible label and URL so call sites cannot pair a
 * valid topic with the wrong documentation page.
 */
export const DOCUMENTATION_TOPICS = {
  aiProviderSettings: {
    href: PHOENIX_DOCUMENTATION_LINKS.providers,
    label: "AI provider settings",
  },
  aiProviders: {
    href: PHOENIX_DOCUMENTATION_LINKS.providers,
    label: "AI providers",
  },
  annotationConfigs: {
    href: PHOENIX_DOCUMENTATION_LINKS.annotationConfigs,
    label: "annotation configs",
  },
  apiKeys: {
    href: PHOENIX_DOCUMENTATION_LINKS.apiKeys,
    label: "API keys",
  },
  customAiProviders: {
    href: PHOENIX_DOCUMENTATION_LINKS.customAiProviders,
    label: "custom AI providers",
  },
  dataRetention: {
    href: PHOENIX_DOCUMENTATION_LINKS.dataRetention,
    label: "data retention",
  },
  datasetLabels: {
    href: PHOENIX_DOCUMENTATION_LINKS.datasetLabels,
    label: "dataset labels",
  },
  defaultRetentionPolicy: {
    href: PHOENIX_DOCUMENTATION_LINKS.dataRetention,
    label: "the default retention policy",
  },
  modelPricing: {
    href: PHOENIX_DOCUMENTATION_LINKS.modelCostTracking,
    label: "model pricing",
  },
  promptLabels: {
    href: PHOENIX_DOCUMENTATION_LINKS.promptLabels,
    label: "prompt labels",
  },
  pxi: {
    href: PHOENIX_DOCUMENTATION_LINKS.pxi,
    label: "PXI",
  },
  sandboxConfigurations: {
    href: PHOENIX_DOCUMENTATION_LINKS.sandboxes,
    label: "sandbox configurations",
  },
  sandboxProviders: {
    href: PHOENIX_DOCUMENTATION_LINKS.sandboxes,
    label: "sandbox providers",
  },
  secrets: {
    href: PHOENIX_DOCUMENTATION_LINKS.secrets,
    label: "secrets",
  },
  userAccess: {
    href: PHOENIX_DOCUMENTATION_LINKS.accessControl,
    label: "user access",
  },
} as const satisfies Record<string, DocumentationTopicDefinition>;

export type DocumentationTopic = keyof typeof DOCUMENTATION_TOPICS;
