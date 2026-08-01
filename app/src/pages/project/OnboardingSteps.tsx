import { css } from "@emotion/react";

import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  ExternalLink,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import { IsAuthenticated } from "@phoenix/components/auth";
import { GenerateAPIKeyButton } from "@phoenix/components/auth";
import { BashBlockWithCopy } from "@phoenix/components/code/BashBlockWithCopy";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PackageManagerCommandBlock } from "@phoenix/components/code/PackageManagerCommandBlock";
import { Separator } from "@phoenix/components/core/toolbar";
import { IS_HOSTED_DEPLOYMENT } from "@phoenix/components/project/hosting";
import { getEnvironmentVariables } from "@phoenix/components/project/integrationSnippets";
import type { EnvVar } from "@phoenix/pages/project/integrationDefinitions";
import type { ProgrammingLanguage } from "@phoenix/types/code";

import { ImplementationCodeBlock } from "./ImplementationCodeBlock";

const docsOnlyContainerCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-200) var(--global-dimension-size-250);
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
`;

// A bordered container that renders the setup instructions as an accordion,
// so each main section (install / environment / trace) can be collapsed.
const stepsAccordionCSS = css`
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  overflow: hidden;
`;

function StepSectionTitle({ children }: { children: string }) {
  return (
    <Text weight="heavy" size="M">
      {children}
    </Text>
  );
}

export function DocsOnlyOnboardingView({
  docsHref,
  githubHref,
  generatedApiKey,
  onApiKeyGenerated,
  extraEnvVars,
}: {
  docsHref: string;
  githubHref?: string;
  generatedApiKey: string | null;
  onApiKeyGenerated: (key: string) => void;
  extraEnvVars?: readonly EnvVar[];
}) {
  const isHosted = IS_HOSTED_DEPLOYMENT;
  const isAuthEnabled = window.Config.authenticationEnabled;
  const envVars = getEnvironmentVariables({
    isAuthEnabled,
    isHosted,
    apiKey: generatedApiKey ?? undefined,
    extraEnvVars,
  });

  return (
    <View paddingTop="size-200">
      <div css={stepsAccordionCSS}>
        <DisclosureGroup defaultExpandedKeys={["environment", "setup-guide"]}>
          <Disclosure id="environment">
            <DisclosureTrigger>
              <StepSectionTitle>
                Configure environment variables
              </StepSectionTitle>
            </DisclosureTrigger>
            <DisclosurePanel>
              <View padding="size-200">
                {isAuthEnabled ? (
                  <View paddingBottom="size-100">
                    <IsAuthenticated>
                      <GenerateAPIKeyButton
                        onApiKeyGenerated={onApiKeyGenerated}
                        keyName="project-setup-generated"
                        isDisabled={!!generatedApiKey}
                      />
                    </IsAuthenticated>
                  </View>
                ) : null}
                <CodeWrap>
                  <BashBlockWithCopy value={envVars} />
                </CodeWrap>
              </View>
            </DisclosurePanel>
          </Disclosure>
          <Disclosure id="setup-guide">
            <DisclosureTrigger>
              <StepSectionTitle>Setup guide</StepSectionTitle>
            </DisclosureTrigger>
            <DisclosurePanel>
              <View padding="size-200">
                <div css={docsOnlyContainerCSS}>
                  <Text>
                    Follow the documentation to set up tracing for this
                    integration.
                  </Text>
                  <Flex direction="row" alignItems="center" gap="size-100">
                    <ExternalLink href={docsHref}>Documentation</ExternalLink>
                    {githubHref && <Separator orientation="vertical" />}
                    {githubHref && (
                      <ExternalLink href={githubHref}>Github</ExternalLink>
                    )}
                  </Flex>
                </div>
              </View>
            </DisclosurePanel>
          </Disclosure>
        </DisclosureGroup>
      </div>
    </View>
  );
}

export function OnboardingSteps({
  language,
  packages,
  implementationCode,
  docsHref,
  githubHref,
  generatedApiKey,
  onApiKeyGenerated,
  extraEnvVars,
}: {
  language: ProgrammingLanguage;
  packages: readonly string[];
  implementationCode: string;
  docsHref?: string;
  githubHref?: string;
  generatedApiKey: string | null;
  onApiKeyGenerated: (key: string) => void;
  extraEnvVars?: readonly EnvVar[];
}) {
  const isHosted = IS_HOSTED_DEPLOYMENT;
  const isAuthEnabled = window.Config.authenticationEnabled;
  const envVars = getEnvironmentVariables({
    isAuthEnabled,
    isHosted,
    apiKey: generatedApiKey ?? undefined,
    extraEnvVars,
  });

  return (
    <View paddingTop="size-200">
      <div css={stepsAccordionCSS}>
        <DisclosureGroup
          defaultExpandedKeys={["install", "environment", "trace"]}
        >
          <Disclosure id="install">
            <DisclosureTrigger>
              <StepSectionTitle>Install dependencies</StepSectionTitle>
            </DisclosureTrigger>
            <DisclosurePanel>
              <View padding="size-200">
                <PackageManagerCommandBlock
                  language={language}
                  packages={packages}
                />
              </View>
            </DisclosurePanel>
          </Disclosure>
          <Disclosure id="environment">
            <DisclosureTrigger>
              <StepSectionTitle>
                Configure environment variables
              </StepSectionTitle>
            </DisclosureTrigger>
            <DisclosurePanel>
              <View padding="size-200">
                {isAuthEnabled ? (
                  <View paddingBottom="size-100">
                    <IsAuthenticated>
                      <GenerateAPIKeyButton
                        onApiKeyGenerated={onApiKeyGenerated}
                        keyName="project-setup-generated"
                        isDisabled={!!generatedApiKey}
                      />
                    </IsAuthenticated>
                  </View>
                ) : null}
                <CodeWrap>
                  <BashBlockWithCopy value={envVars} />
                </CodeWrap>
              </View>
            </DisclosurePanel>
          </Disclosure>
          <Disclosure id="trace">
            <DisclosureTrigger>
              <StepSectionTitle>Trace LLM calls</StepSectionTitle>
            </DisclosureTrigger>
            <DisclosurePanel>
              <View padding="size-200">
                {(docsHref || githubHref) && (
                  <Flex
                    direction="row"
                    alignItems="center"
                    gap="size-50"
                    justifyContent="end"
                    marginBottom="size-100"
                  >
                    {githubHref && (
                      <ExternalLink href={githubHref}>Github</ExternalLink>
                    )}
                    {githubHref && docsHref && (
                      <Separator orientation="vertical" />
                    )}
                    {docsHref && (
                      <ExternalLink href={docsHref}>Docs</ExternalLink>
                    )}
                  </Flex>
                )}
                <CodeWrap>
                  <ImplementationCodeBlock
                    language={language}
                    code={implementationCode}
                  />
                </CodeWrap>
              </View>
            </DisclosurePanel>
          </Disclosure>
        </DisclosureGroup>
      </div>
    </View>
  );
}
