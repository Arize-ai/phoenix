import type { ReactNode } from "react";

import type { ProgrammingLanguage } from "@phoenix/types/code";

export type EnvVar = { name: string; value: string };

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
  envVars?: readonly EnvVar[];
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

export type OnboardingTab = ProgrammingLanguage | "Platform";

/**
 * An integration that can be selected on the onboarding page.
 * Each tab key (Python, TypeScript, or Platform) maps to either
 * code snippets or a docs-only configuration.
 */
export type OnboardingIntegration = {
  id: string;
  name: string;
  icon: ReactNode;
  configs: Partial<Record<OnboardingTab, IntegrationLanguageConfig>>;
};
