import { css } from "@emotion/react";
import { useState } from "react";

import {
  Flex,
  Heading,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  View,
} from "@phoenix/components";
import { IsAuthenticated } from "@phoenix/components/auth";
import { GenerateAPIKeyButton } from "@phoenix/components/auth";
import { BashBlockWithCopy } from "@phoenix/components/code/BashBlockWithCopy";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PackageManagerCommandBlock } from "@phoenix/components/code/PackageManagerCommandBlock";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { TypeScriptBlockWithCopy } from "@phoenix/components/code/TypeScriptBlockWithCopy";
import { IS_HOSTED_DEPLOYMENT } from "@phoenix/components/project/hosting";
import {
  getEnvironmentVariables,
  getOtelInitCodePython,
  getOtelInitCodeTypescript,
  PYTHON_PACKAGES,
  TYPESCRIPT_PACKAGES,
} from "@phoenix/components/project/integrationSnippets";
import type { ProgrammingLanguage } from "@phoenix/types/code";

import type { StreamToggle_data$key } from "./__generated__/StreamToggle_data.graphql";
import { StreamToggle } from "./StreamToggle";

const onboardingPageCSS = css`
  overflow-y: auto;
  height: 100%;
`;

const onboardingPageInnerCSS = css`
  padding: var(--global-dimension-size-400);
  max-width: 800px;
  min-width: 500px;
  box-sizing: border-box;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
`;

export function ProjectOnboardingWaitingForTraces({
  project,
  projectName,
}: {
  project: StreamToggle_data$key;
  projectName: string;
}) {
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  return (
    <div css={onboardingPageCSS}>
      <div css={onboardingPageInnerCSS}>
        <Flex direction="column" width="100%" gap="size-200">
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            width="100%"
          >
            <Heading level={2}>Project setup</Heading>
            <StreamToggle project={project} />
          </Flex>
          <Tabs>
            <TabList>
              <Tab id="python">Python</Tab>
              <Tab id="typescript">Typescript</Tab>
            </TabList>
            <TabPanel id="python">
              <OnboardingSteps
                language="Python"
                projectName={projectName}
                generatedApiKey={generatedApiKey}
                onApiKeyGenerated={setGeneratedApiKey}
              />
            </TabPanel>
            <TabPanel id="typescript">
              <OnboardingSteps
                language="TypeScript"
                projectName={projectName}
                generatedApiKey={generatedApiKey}
                onApiKeyGenerated={setGeneratedApiKey}
              />
            </TabPanel>
          </Tabs>
        </Flex>
      </div>
    </div>
  );
}

function ImplementationCodeBlock({
  language,
  projectName,
  isHosted,
}: {
  language: ProgrammingLanguage;
  projectName: string;
  isHosted: boolean;
}) {
  if (language === "Python") {
    return (
      <PythonBlockWithCopy
        value={getOtelInitCodePython({ isHosted, projectName })}
      />
    );
  }
  return (
    <TypeScriptBlockWithCopy value={getOtelInitCodeTypescript(projectName)} />
  );
}

function OnboardingSteps({
  language,
  projectName,
  generatedApiKey,
  onApiKeyGenerated,
}: {
  language: ProgrammingLanguage;
  projectName: string;
  generatedApiKey: string | null;
  onApiKeyGenerated: (key: string) => void;
}) {
  const isHosted = IS_HOSTED_DEPLOYMENT;
  const isAuthEnabled = window.Config.authenticationEnabled;
  const packages =
    language === "Python" ? [...PYTHON_PACKAGES] : [...TYPESCRIPT_PACKAGES];
  const envVars = getEnvironmentVariables({
    isAuthEnabled,
    isHosted,
    apiKey: generatedApiKey ?? undefined,
  });

  return (
    <View paddingTop="size-200">
      <View paddingBottom="size-200">
        <View paddingBottom="size-100">
          <Heading level={3} weight="heavy">
            Install dependencies
          </Heading>
        </View>
        <PackageManagerCommandBlock language={language} packages={packages} />
      </View>
      <View paddingBottom="size-200">
        <View paddingBottom="size-100">
          <Heading level={3} weight="heavy">
            Environment variables
          </Heading>
        </View>
        {isAuthEnabled ? (
          <View paddingBottom="size-100">
            <IsAuthenticated>
              <GenerateAPIKeyButton
                onApiKeyGenerated={onApiKeyGenerated}
                keyName="project-setup-generated"
              />
            </IsAuthenticated>
          </View>
        ) : null}
        <CodeWrap>
          <BashBlockWithCopy value={envVars} />
        </CodeWrap>
      </View>
      <View paddingBottom="size-200">
        <View paddingBottom="size-100">
          <Heading level={3} weight="heavy">
            Implementation
          </Heading>
        </View>
        <CodeWrap>
          <ImplementationCodeBlock
            language={language}
            projectName={projectName}
            isHosted={isHosted}
          />
        </CodeWrap>
      </View>
    </View>
  );
}
