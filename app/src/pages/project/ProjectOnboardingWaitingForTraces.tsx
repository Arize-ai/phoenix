import { useState } from "react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { IsAuthenticated } from "@phoenix/components/auth";
import { GenerateAPIKeyButton } from "@phoenix/components/auth";
import { BashBlockWithCopy } from "@phoenix/components/code/BashBlockWithCopy";
import { CodeLanguageRadioGroup } from "@phoenix/components/code/CodeLanguageRadioGroup";
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
import { usePreferencesContext } from "@phoenix/contexts";

import type { StreamToggle_data$key } from "./__generated__/StreamToggle_data.graphql";
import { StreamToggle } from "./StreamToggle";

export function ProjectOnboardingWaitingForTraces({
  project,
  projectName,
}: {
  project: StreamToggle_data$key;
  projectName: string;
}) {
  const { programmingLanguage, setProgrammingLanguage } = usePreferencesContext(
    (state) => ({
      programmingLanguage: state.programmingLanguage,
      setProgrammingLanguage: state.setProgrammingLanguage,
    })
  );
  const isHosted = IS_HOSTED_DEPLOYMENT;
  const isAuthEnabled = window.Config.authenticationEnabled;
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);

  const isPython = programmingLanguage === "Python";
  const packages = isPython ? [...PYTHON_PACKAGES] : [...TYPESCRIPT_PACKAGES];
  const envVars = getEnvironmentVariables({
    isAuthEnabled,
    isHosted,
    apiKey: generatedApiKey ?? undefined,
  });
  const implementationCode = isPython
    ? getOtelInitCodePython({ isHosted, projectName })
    : getOtelInitCodeTypescript(projectName);

  return (
    <View padding="size-200" height="100%" overflow="auto">
      <Flex direction="column" height="100%" width="100%">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
        >
          <Heading level={2}>Project setup</Heading>
          <StreamToggle project={project} />
        </Flex>
        <View paddingTop="size-200" paddingBottom="size-200">
          <CodeLanguageRadioGroup
            language={programmingLanguage}
            onChange={setProgrammingLanguage}
          />
        </View>
        <View paddingBottom="size-200">
          <View paddingBottom="size-100">
            <Heading level={3} weight="heavy">
              Install dependencies
            </Heading>
          </View>
          <PackageManagerCommandBlock
            language={programmingLanguage}
            packages={packages}
          />
        </View>
        <View paddingBottom="size-200">
          <View paddingBottom="size-100">
            <Flex
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              gap="size-100"
            >
              <Heading level={3} weight="heavy">
                Environment variables
              </Heading>
              {isAuthEnabled && !generatedApiKey ? (
                <IsAuthenticated>
                  <GenerateAPIKeyButton
                    onApiKeyGenerated={setGeneratedApiKey}
                    keyName="project-setup-generated"
                  />
                </IsAuthenticated>
              ) : null}
            </Flex>
          </View>
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
          <View paddingBottom="size-100">
            <Text>
              Add this code <b>before</b> any other code in your application.
            </Text>
          </View>
          <CodeWrap>
            {isPython ? (
              <PythonBlockWithCopy value={implementationCode} />
            ) : (
              <TypeScriptBlockWithCopy value={implementationCode} />
            )}
          </CodeWrap>
        </View>
      </Flex>
    </View>
  );
}
