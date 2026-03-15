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
import { IS_HOSTED_DEPLOYMENT } from "@phoenix/components/project/hosting";
import { usePreferencesContext } from "@phoenix/contexts";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";
import type { ProgrammingLanguage } from "@phoenix/types/code";

import { ONBOARDING_INTEGRATIONS } from "./integrationRegistry";
import { IntegrationSelectButtonGroup } from "./IntegrationSelectButtonGroup";
import { OnboardingSteps } from "./OnboardingSteps";

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

export function ProjectOnboarding({ projectName }: { projectName: string }) {
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const { isStreaming } = useStreamState();
  const programmingLanguage = usePreferencesContext(
    (state) => state.programmingLanguage
  );

  const [integration, setIntegration] = useState(ONBOARDING_INTEGRATIONS[0]);
  const [selectedLanguage, setSelectedLanguage] =
    useState<ProgrammingLanguage>(programmingLanguage);

  // If the current language isn't supported by the selected integration,
  // fall back to the first supported language.
  const effectiveLanguage: ProgrammingLanguage =
    integration.supportedLanguages.includes(selectedLanguage)
      ? selectedLanguage
      : integration.supportedLanguages[0];

  const languageSnippets = integration.snippets[effectiveLanguage];
  const packages = languageSnippets?.packages ?? [];
  const implementationCode =
    languageSnippets?.getImplementationCode({
      projectName,
      isHosted: IS_HOSTED_DEPLOYMENT,
    }) ?? "";
  const docsHref = languageSnippets?.docsHref;
  const githubHref = languageSnippets?.githubHref;

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
                ? "Awaiting traces..."
                : "Follow the steps below to start sending traces"}
            </Text>
          </div>
          <IntegrationSelectButtonGroup
            selectedIntegration={integration}
            onSelectionChange={(nextIntegration) => {
              setIntegration(nextIntegration);
              if (
                !nextIntegration.supportedLanguages.includes(selectedLanguage)
              ) {
                setSelectedLanguage(nextIntegration.supportedLanguages[0]);
              }
            }}
          />
          <Tabs
            selectedKey={effectiveLanguage}
            onSelectionChange={(key) =>
              setSelectedLanguage(String(key) as ProgrammingLanguage)
            }
          >
            <TabList>
              {integration.supportedLanguages.includes("Python") && (
                <Tab id="Python">Python</Tab>
              )}
              {integration.supportedLanguages.includes("TypeScript") && (
                <Tab id="TypeScript">TypeScript</Tab>
              )}
            </TabList>
            {integration.supportedLanguages.includes("Python") && (
              <TabPanel id="Python">
                <OnboardingSteps
                  language="Python"
                  packages={packages}
                  implementationCode={implementationCode}
                  docsHref={docsHref}
                  githubHref={githubHref}
                  generatedApiKey={generatedApiKey}
                  onApiKeyGenerated={setGeneratedApiKey}
                />
              </TabPanel>
            )}
            {integration.supportedLanguages.includes("TypeScript") && (
              <TabPanel id="TypeScript">
                <OnboardingSteps
                  language="TypeScript"
                  packages={packages}
                  implementationCode={implementationCode}
                  docsHref={docsHref}
                  githubHref={githubHref}
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
