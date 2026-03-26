import { css } from "@emotion/react";
import { useState } from "react";

import {
  Flex,
  ProgressCircle,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
} from "@phoenix/components";
import {
  PythonSVG,
  Server,
  TypeScriptSVG,
} from "@phoenix/components/core/icon/Icons";
import { usePreferencesContext } from "@phoenix/contexts";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import type { ProgrammingLanguage } from "@phoenix/types/code";

import { hasSnippets } from "./integrationDefinitions";
import { ONBOARDING_INTEGRATIONS } from "./integrationRegistry";
import { IntegrationSelectButtonGroup } from "./IntegrationSelectButtonGroup";
import { DocsOnlyOnboardingView, OnboardingSteps } from "./OnboardingSteps";

type LanguageTab = ProgrammingLanguage | "Platform";

const onboardingCSS = css`
  overflow-y: auto;
  height: 100%;
  scrollbar-gutter: stable;
`;

const onboardingInnerCSS = css`
  padding: var(--global-dimension-size-400);
  max-width: 1000px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

const awaitingTracesCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  background-color: var(--global-color-gray-100);
  border-radius: var(--global-rounding-medium);
`;

const languageTabCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
`;

export function ProjectOnboarding({ projectName }: { projectName: string }) {
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const { isStreaming } = useStreamState();
  const programmingLanguage = usePreferencesContext(
    (state) => state.programmingLanguage
  );

  const [integration, setIntegration] = useState(ONBOARDING_INTEGRATIONS[0]);
  const [selectedLanguage, setSelectedLanguage] =
    useState<LanguageTab>(programmingLanguage);

  // Determine the effective tab: prefer the user's selected language if supported,
  // otherwise fall back to the first supported language, or "Platform" for
  // integrations that only have a platformConfig.
  const effectiveLanguage: LanguageTab = (() => {
    if (
      integration.supportedLanguages.includes(
        selectedLanguage as ProgrammingLanguage
      )
    ) {
      return selectedLanguage as ProgrammingLanguage;
    }
    if (integration.supportedLanguages.length > 0) {
      return integration.supportedLanguages[0];
    }
    return "Platform";
  })();

  const languageConfig =
    effectiveLanguage === "Platform"
      ? integration.platformConfig
      : integration.languages[effectiveLanguage];
  const isDocsOnly = languageConfig && !hasSnippets(languageConfig);

  return (
    <div css={onboardingCSS}>
      <div css={onboardingInnerCSS}>
        <Flex direction="column" gap="size-200">
          <div css={awaitingTracesCSS}>
            {isStreaming ? (
              <ProgressCircle isIndeterminate size="S" aria-label="loading" />
            ) : null}
            <Text>
              {isStreaming
                ? "Waiting for traces to arrive..."
                : "Follow the steps below to start sending traces"}
            </Text>
          </div>
          <IntegrationSelectButtonGroup
            selectedIntegration={integration}
            onSelectionChange={(nextIntegration) => {
              setIntegration(nextIntegration);
              if (
                !nextIntegration.supportedLanguages.includes(
                  selectedLanguage as ProgrammingLanguage
                )
              ) {
                if (nextIntegration.supportedLanguages.length > 0) {
                  setSelectedLanguage(nextIntegration.supportedLanguages[0]);
                } else if (nextIntegration.platformConfig) {
                  setSelectedLanguage("Platform");
                }
              }
            }}
          />
          <Tabs
            selectedKey={effectiveLanguage}
            onSelectionChange={(key) =>
              setSelectedLanguage(String(key) as LanguageTab)
            }
          >
            <TabList>
              {integration.supportedLanguages.includes("Python") && (
                <Tab id="Python">
                  <span css={languageTabCSS}>
                    <PythonSVG />
                    Python
                  </span>
                </Tab>
              )}
              {integration.supportedLanguages.includes("TypeScript") && (
                <Tab id="TypeScript">
                  <span css={languageTabCSS}>
                    <TypeScriptSVG />
                    TypeScript
                  </span>
                </Tab>
              )}
              {integration.platformConfig && (
                <Tab id="Platform">
                  <span css={languageTabCSS}>
                    <Server />
                    Platform
                  </span>
                </Tab>
              )}
            </TabList>
            {integration.supportedLanguages.includes("Python") && (
              <TabPanel id="Python">
                {isDocsOnly ? (
                  <DocsOnlyOnboardingView
                    docsHref={languageConfig.docsHref}
                    githubHref={languageConfig.githubHref}
                    generatedApiKey={generatedApiKey}
                    onApiKeyGenerated={setGeneratedApiKey}
                  />
                ) : (
                  <OnboardingSteps
                    language="Python"
                    packages={
                      languageConfig && hasSnippets(languageConfig)
                        ? languageConfig.packages
                        : []
                    }
                    implementationCode={
                      languageConfig && hasSnippets(languageConfig)
                        ? languageConfig.getImplementationCode({ projectName })
                        : ""
                    }
                    docsHref={languageConfig?.docsHref}
                    githubHref={languageConfig?.githubHref}
                    generatedApiKey={generatedApiKey}
                    onApiKeyGenerated={setGeneratedApiKey}
                  />
                )}
              </TabPanel>
            )}
            {integration.supportedLanguages.includes("TypeScript") && (
              <TabPanel id="TypeScript">
                {isDocsOnly ? (
                  <DocsOnlyOnboardingView
                    docsHref={languageConfig.docsHref}
                    githubHref={languageConfig.githubHref}
                    generatedApiKey={generatedApiKey}
                    onApiKeyGenerated={setGeneratedApiKey}
                  />
                ) : (
                  <OnboardingSteps
                    language="TypeScript"
                    packages={
                      languageConfig && hasSnippets(languageConfig)
                        ? languageConfig.packages
                        : []
                    }
                    implementationCode={
                      languageConfig && hasSnippets(languageConfig)
                        ? languageConfig.getImplementationCode({ projectName })
                        : ""
                    }
                    docsHref={languageConfig?.docsHref}
                    githubHref={languageConfig?.githubHref}
                    generatedApiKey={generatedApiKey}
                    onApiKeyGenerated={setGeneratedApiKey}
                  />
                )}
              </TabPanel>
            )}
            {integration.platformConfig && (
              <TabPanel id="Platform">
                <DocsOnlyOnboardingView
                  docsHref={integration.platformConfig.docsHref}
                  githubHref={integration.platformConfig.githubHref}
                  generatedApiKey={generatedApiKey}
                  onApiKeyGenerated={setGeneratedApiKey}
                />
              </TabPanel>
            )}
          </Tabs>
        </Flex>
      </div>
    </div>
  );
}
