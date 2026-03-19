import type { ReactNode } from "react";

import type { ProgrammingLanguage } from "@phoenix/types/code";

type BaseIntegrationConfig = {
  githubHref?: string;
};

/**
 * Language config with install packages and implementation code snippets.
 */
type SnippetLanguageConfig = BaseIntegrationConfig & {
  packages: readonly string[];
  getImplementationCode: (params: { projectName: string }) => string;
  docsHref?: string;
};

/**
 * Language config that links to external documentation only (no code snippets).
 */
type DocsOnlyIntegrationConfig = BaseIntegrationConfig & {
  docsHref: string;
};

/**
 * Per-language configuration for an onboarding integration.
 * Either provides code snippets (packages + implementation) or links to docs.
 */
export type IntegrationLanguageConfig =
  | SnippetLanguageConfig
  | DocsOnlyIntegrationConfig;

/**
 * Type guard to check if a language config has code snippets.
 */
export function hasSnippets(
  config: IntegrationLanguageConfig
): config is SnippetLanguageConfig {
  return "packages" in config && "getImplementationCode" in config;
}

/**
 * An integration that can be selected on the onboarding page.
 * Each integration defines which languages it supports and provides
 * per-language install + implementation snippets or documentation links.
 */
export type OnboardingIntegration = {
  id: string;
  name: string;
  icon: ReactNode;
  supportedLanguages: readonly ProgrammingLanguage[];
  languages: Partial<Record<ProgrammingLanguage, IntegrationLanguageConfig>>;
};
