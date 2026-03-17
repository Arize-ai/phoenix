import { useState } from "react";

import {
  ExternalLink,
  Flex,
  Heading,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  View,
} from "@phoenix/components";
import {
  GenerateAPIKeyButton,
  IsAdmin,
  IsAuthenticated,
} from "@phoenix/components/auth";
import { BashBlockWithCopy } from "@phoenix/components/code/BashBlockWithCopy";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PackageManagerCommandBlock } from "@phoenix/components/code/PackageManagerCommandBlock";

import { TypeScriptBlockWithCopy } from "../code/TypeScriptBlockWithCopy";
import { IS_HOSTED_DEPLOYMENT } from "./hosting";
import {
  TypeScriptIntegrations,
  TypeScriptPlatformIntegrations,
} from "./Integrations";
import {
  getEnvironmentVariables,
  getOtelInitCodeTypescript,
} from "./integrationSnippets";

type PythonProjectGuideProps = {
  /**
   * An existing project name
   */
  projectName?: string;
};

const PHOENIX_OTEL_DOC_LINK =
  "https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing";

const getAutoInstrumentationCode = (projectName: string) => {
  return `import { register } from '@arizeai/phoenix-otel';
import { OpenAIInstrumentation } from '@arizeai/openinference-instrumentation-openai';

register({
  projectName: '${projectName}',
  instrumentations: [
    new OpenAIInstrumentation(),
  ],
});`;
};

const getOpenAIInstrumentationCode = (projectName: string) => {
  return `// instrumentation.ts
import { register, registerInstrumentations } from '@arizeai/phoenix-otel';
import OpenAI from 'openai';
import { OpenAIInstrumentation } from '@arizeai/openinference-instrumentation-openai';

register({
  projectName: '${projectName}',
});

// Manual instrumentation for ESM
const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

registerInstrumentations({
  instrumentations: [instrumentation],
});`;
};

export function TypeScriptProjectGuide(props: PythonProjectGuideProps) {
  const existingProjectName = props.projectName;
  const projectName = existingProjectName || "your-next-llm-project";
  const isAuthEnabled = window.Config.authenticationEnabled;
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const isHosted = IS_HOSTED_DEPLOYMENT;
  const phoenixOtelEnvVars = getEnvironmentVariables({
    isAuthEnabled,
    isHosted,
    apiKey: generatedApiKey ?? undefined,
  });
  return (
    <div>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Install Phoenix OpenTelemetry
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Install the{" "}
          <ExternalLink href="https://www.npmjs.com/package/@arizeai/phoenix-otel">
            @arizeai/phoenix-otel
          </ExternalLink>{" "}
          package, a lightweight wrapper around{" "}
          <ExternalLink href={PHOENIX_OTEL_DOC_LINK}>
            OpenTelemetry
          </ExternalLink>{" "}
          that simplifies sending traces to Phoenix.
        </Text>
      </View>
      <PackageManagerCommandBlock
        language="TypeScript"
        packages={["@arizeai/phoenix-otel"]}
      />

      <View paddingY="size-100">
        <Text>
          alternatively, you may want to use a platform or integration specific
          setup:{" "}
        </Text>
      </View>
      <View paddingBottom="size-100">
        <TypeScriptPlatformIntegrations />
      </View>

      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Quick Start
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>Use the register function to set up tracing</Text>
      </View>
      <CodeWrap>
        <TypeScriptBlockWithCopy
          value={getOtelInitCodeTypescript({ projectName })}
        />
      </CodeWrap>
      <IsAuthenticated>
        <View paddingBottom="size-100" paddingTop="size-100">
          <IsAdmin
            fallback={
              <Text>
                Your personal API keys can be created and managed on your{" "}
                <ExternalLink href="/profile">Profile</ExternalLink>
              </Text>
            }
          >
            <Text>
              System API keys can be created and managed in{" "}
              <ExternalLink href="/settings/general">Settings</ExternalLink>
            </Text>
          </IsAdmin>
        </View>
      </IsAuthenticated>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Environment Variables
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          gap="size-100"
        >
          <Text>
            Alternatively, you can configure Phoenix using environment
            variables:
          </Text>
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
        <BashBlockWithCopy value={phoenixOtelEnvVars} />
      </CodeWrap>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Setup Instrumentation
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Add instrumentation to your application so that your application code
          is traced.
        </Text>
      </View>
      <View borderColor="default" borderWidth="thin" borderRadius="medium">
        <Tabs>
          <TabList>
            <Tab id="integrations">Integrations</Tab>
            <Tab id="commonjs">CommonJS</Tab>
            <Tab id="esm">ESM</Tab>
          </TabList>
          <TabPanel id="integrations">
            <View padding="size-200">
              <Text>
                Browse our integrations for popular frameworks and libraries:
              </Text>
              <View paddingTop="size-200" paddingBottom="size-200">
                <TypeScriptIntegrations />
              </View>
              <Text>
                For more integrations, checkout our{" "}
                <ExternalLink href="https://arize.com/docs/phoenix/tracing/integrations-tracing">
                  comprehensive guide
                </ExternalLink>
              </Text>
            </View>
          </TabPanel>
          <TabPanel id="commonjs">
            <View padding="size-200">
              <Text>
                For CommonJS projects, you can automatically instrument
                libraries using the <b>instrumentations</b> parameter:
              </Text>
              <View paddingTop="size-200">
                <CodeWrap>
                  <TypeScriptBlockWithCopy
                    value={getAutoInstrumentationCode(projectName)}
                  />
                </CodeWrap>
              </View>
            </View>
          </TabPanel>
          <TabPanel id="esm">
            <View padding="size-200">
              <Text>
                For ESM projects, manually instrument libraries. Here&apos;s an
                example with OpenAI:
              </Text>
              <View paddingTop="size-200">
                <CodeWrap>
                  <TypeScriptBlockWithCopy
                    value={getOpenAIInstrumentationCode(projectName)}
                  />
                </CodeWrap>
              </View>
            </View>
          </TabPanel>
        </Tabs>
      </View>
    </div>
  );
}
