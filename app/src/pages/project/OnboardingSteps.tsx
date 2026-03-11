import { Heading, View } from "@phoenix/components";
import { IsAuthenticated } from "@phoenix/components/auth";
import { GenerateAPIKeyButton } from "@phoenix/components/auth";
import { BashBlockWithCopy } from "@phoenix/components/code/BashBlockWithCopy";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PackageManagerCommandBlock } from "@phoenix/components/code/PackageManagerCommandBlock";
import { IS_HOSTED_DEPLOYMENT } from "@phoenix/components/project/hosting";
import { getEnvironmentVariables } from "@phoenix/components/project/integrationSnippets";
import type { ProgrammingLanguage } from "@phoenix/types/code";

import { ImplementationCodeBlock } from "./ImplementationCodeBlock";

export function OnboardingSteps({
  language,
  packages,
  implementationCode,
  generatedApiKey,
  onApiKeyGenerated,
}: {
  language: ProgrammingLanguage;
  packages: readonly string[];
  implementationCode: string;
  generatedApiKey: string | null;
  onApiKeyGenerated: (key: string) => void;
}) {
  const isHosted = IS_HOSTED_DEPLOYMENT;
  const isAuthEnabled = window.Config.authenticationEnabled;
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
            code={implementationCode}
          />
        </CodeWrap>
      </View>
    </View>
  );
}
