import type { ReactNode } from "react";

import type { ProgrammingLanguage } from "@phoenix/types/code";

/**
 * Per-language snippet data for an onboarding integration.
 */
export type IntegrationSnippets = {
  packages: readonly string[];
  getImplementationCode: (params: { projectName: string }) => string;
  docsHref?: string;
  githubHref?: string;
};

/**
 * An integration that can be selected on the onboarding page.
 * Each integration defines which languages it supports and provides
 * per-language install + implementation snippets.
 */
export type OnboardingIntegration = {
  id: string;
  name: string;
  icon: ReactNode;
  supportedLanguages: readonly ProgrammingLanguage[];
  snippets: Partial<Record<ProgrammingLanguage, IntegrationSnippets>>;
};
