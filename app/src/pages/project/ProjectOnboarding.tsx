import { css } from "@emotion/react";
import type { Key } from "react";
import { useState } from "react";

import {
  ComboBox,
  ComboBoxItem,
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

// When rendered inline (e.g. inside the projects-page onboarding card) the
// component should size to its content and let the parent own scrolling.
const onboardingEmbeddedInnerCSS = css`
  box-sizing: border-box;
  width: 100%;
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

const stepEyebrowCSS = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 var(--global-dimension-size-75);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-color-primary-100);
  color: var(--global-color-primary);
  font-size: var(--global-font-size-xs);
  font-weight: 600;
`;

/**
 * A numbered step header used to sequence the standalone onboarding flow
 * (select a project → choose an SDK → follow the setup steps).
 */
function StepHeading({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description?: string;
}) {
  return (
    <Flex direction="column" gap="size-50">
      <Flex direction="row" gap="size-100" alignItems="center">
        <span css={stepEyebrowCSS}>{step}</span>
        <Text weight="heavy" size="M">
          {title}
        </Text>
      </Flex>
      {description ? (
        <Text color="text-700" size="S">
          {description}
        </Text>
      ) : null}
    </Flex>
  );
}

/**
 * Lets the user pick an existing project or type a brand-new name. The chosen
 * name is injected into every setup snippet; Phoenix creates the project when
 * its first trace arrives, so no project needs to exist up front.
 */
function ProjectNameComboBox({
  projectNames,
  value,
  onChange,
}: {
  projectNames: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ComboBox
      aria-label="Project name"
      placeholder="Select or type a project name"
      width="320px"
      allowsCustomValue
      menuTrigger="focus"
      inputValue={value}
      onInputChange={onChange}
      onSelectionChange={(key: Key | null) => {
        if (typeof key === "string") {
          onChange(key);
        }
      }}
    >
      {projectNames.map((name) => (
        <ComboBoxItem key={name} id={name} textValue={name}>
          {name}
        </ComboBoxItem>
      ))}
    </ComboBox>
  );
}

/**
 * The "waiting for traces" status banner. It reads the trace stream state,
 * which is only available under a `StreamStateProvider` (i.e. within a project
 * page). It is isolated into its own component so `ProjectOnboarding` can be
 * embedded on surfaces without that provider (e.g. the projects list page)
 * without calling `useStreamState` there.
 */
function AwaitingTracesBanner() {
  const { isStreaming } = useStreamState();
  return (
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
  );
}

export function ProjectOnboarding({
  projectName,
  embedded = false,
  showProjectSelector = false,
  projectNames = [],
}: {
  projectName: string;
  /**
   * When true, render inline (no full-height scroll container, no
   * "waiting for traces" status banner) so the panel can be embedded inside
   * another surface such as the projects-page onboarding card.
   */
  embedded?: boolean;
  /**
   * When true, prepend a "select a project" step so the user can choose which
   * project the setup snippets target. Used on the projects list page, where
   * (unlike inside a project) there is no fixed project context.
   */
  showProjectSelector?: boolean;
  /** Existing project names to offer in the project selector. */
  projectNames?: readonly string[];
}) {
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const preferredProgrammingLanguage = usePreferencesContext(
    (state) => state.programmingLanguage
  );

  const [selectedProjectName, setSelectedProjectName] = useState(projectName);
  // Inside a project the name is fixed; only the selector-driven flow lets the
  // user change which project the snippets target.
  const effectiveProjectName = showProjectSelector
    ? selectedProjectName
    : projectName;

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
    <div css={embedded ? undefined : onboardingCSS}>
      <div css={embedded ? onboardingEmbeddedInnerCSS : onboardingInnerCSS}>
        <Flex direction="column" gap={showProjectSelector ? "size-300" : "size-200"}>
          {embedded ? null : <AwaitingTracesBanner />}
          {showProjectSelector ? (
            <Flex direction="column" gap="size-150">
              <StepHeading
                step={1}
                title="Select a project"
                description="Traces are grouped by project. Choose an existing project or type a new name to create one."
              />
              <ProjectNameComboBox
                projectNames={projectNames}
                value={selectedProjectName}
                onChange={setSelectedProjectName}
              />
            </Flex>
          ) : null}
          <Flex direction="column" gap="size-150">
            {showProjectSelector ? (
              <StepHeading step={2} title="Choose your SDK" />
            ) : null}
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
          </Flex>
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
                        ? config.getImplementationCode({
                          projectName: effectiveProjectName,
                        })
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
                        ? config.getImplementationCode({
                          projectName: effectiveProjectName,
                        })
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
