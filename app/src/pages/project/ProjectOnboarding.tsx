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
import { Icon } from "@phoenix/components/core/icon/Icon";
import { PythonSVG, TypeScriptSVG } from "@phoenix/components/core/icon/Icons";
import { usePreferencesContext } from "@phoenix/contexts";
import { useStreamState } from "@phoenix/contexts/StreamStateContext";

import { hasSnippets, type OnboardingTab } from "./integrationDefinitions";
import { ONBOARDING_INTEGRATIONS } from "./integrationRegistry";
import { IntegrationSelectButtonGroup } from "./IntegrationSelectButtonGroup";
import { DocsOnlyOnboardingView, OnboardingSteps } from "./OnboardingSteps";

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
  const preferredProgrammingLanguage = usePreferencesContext(
    (state) => state.programmingLanguage
  );

  const [integration, setIntegration] = useState(ONBOARDING_INTEGRATIONS[0]);
  const [selectedTab, setSelectedTab] = useState<OnboardingTab>(
    preferredProgrammingLanguage
  );

  const tabs = Object.keys(integration.configs) as OnboardingTab[];
  const effectiveTab: OnboardingTab = tabs.includes(selectedTab)
    ? selectedTab
    : tabs[0];
  const config = integration.configs[effectiveTab];
  const isDocsOnly = config != null && !hasSnippets(config);

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
              const nextTabs = Object.keys(
                nextIntegration.configs
              ) as OnboardingTab[];
              if (!nextTabs.includes(selectedTab)) {
                setSelectedTab(nextTabs[0]);
              }
            }}
          />
          <Tabs
            selectedKey={effectiveTab}
            onSelectionChange={(key) =>
              setSelectedTab(String(key) as OnboardingTab)
            }
          >
            <TabList>
              {"Python" in integration.configs && (
                <Tab id="Python">
                  <span css={languageTabCSS}>
                    <PythonSVG />
                    Python
                  </span>
                </Tab>
              )}
              {"TypeScript" in integration.configs && (
                <Tab id="TypeScript">
                  <span css={languageTabCSS}>
                    <TypeScriptSVG />
                    TypeScript
                  </span>
                </Tab>
              )}
              {"Platform" in integration.configs && (
                <Tab id="Platform">
                  <span css={languageTabCSS}>
                    <Icon
                      svgKey="Server"
                      css={css`
                        font-size: 16px;
                      `}
                    />
                    Platform
                  </span>
                </Tab>
              )}
            </TabList>
            {"Python" in integration.configs && (
              <TabPanel id="Python">
                {isDocsOnly ? (
                  <DocsOnlyOnboardingView
                    docsHref={config.docsHref}
                    githubHref={config.githubHref}
                    generatedApiKey={generatedApiKey}
                    onApiKeyGenerated={setGeneratedApiKey}
                  />
                ) : (
                  <OnboardingSteps
                    language="Python"
                    packages={
                      config && hasSnippets(config) ? config.packages : []
                    }
                    implementationCode={
                      config && hasSnippets(config)
                        ? config.getImplementationCode({ projectName })
                        : ""
                    }
                    docsHref={config?.docsHref}
                    githubHref={config?.githubHref}
                    generatedApiKey={generatedApiKey}
                    onApiKeyGenerated={setGeneratedApiKey}
                    extraEnvVars={
                      config && hasSnippets(config) ? config.envVars : undefined
                    }
                  />
                )}
              </TabPanel>
            )}
            {"TypeScript" in integration.configs && (
              <TabPanel id="TypeScript">
                {isDocsOnly ? (
                  <DocsOnlyOnboardingView
                    docsHref={config.docsHref}
                    githubHref={config.githubHref}
                    generatedApiKey={generatedApiKey}
                    onApiKeyGenerated={setGeneratedApiKey}
                  />
                ) : (
                  <OnboardingSteps
                    language="TypeScript"
                    packages={
                      config && hasSnippets(config) ? config.packages : []
                    }
                    implementationCode={
                      config && hasSnippets(config)
                        ? config.getImplementationCode({ projectName })
                        : ""
                    }
                    docsHref={config?.docsHref}
                    githubHref={config?.githubHref}
                    generatedApiKey={generatedApiKey}
                    onApiKeyGenerated={setGeneratedApiKey}
                    extraEnvVars={
                      config && hasSnippets(config) ? config.envVars : undefined
                    }
                  />
                )}
              </TabPanel>
            )}
            {"Platform" in integration.configs &&
              config &&
              !hasSnippets(config) && (
                <TabPanel id="Platform">
                  <DocsOnlyOnboardingView
                    docsHref={config.docsHref}
                    githubHref={config.githubHref}
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
