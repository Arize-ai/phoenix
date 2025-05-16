import { ExternalLink, Heading, Text, View } from "@phoenix/components";
import { IsAdmin, IsAuthenticated } from "@phoenix/components/auth";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";

import { TypeScriptBlockWithCopy } from "../code/TypeScriptBlockWithCopy";

import { IS_HOSTED_DEPLOYMENT } from "./hosting";
import {
  TypeScriptIntegrations,
  TypeScriptPlatformIntegrations,
} from "./Integrations";

type PythonProjectGuideProps = {
  /**
   * An existing project name
   */
  projectName?: string;
};

const PHOENIX_OTEL_DOC_LINK =
  "https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing";

const getSetProjectNameCode = (projectName: string) => {
  return `import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions';

resource: new Resource({
    [SEMRESATTRS_PROJECT_NAME]: "${projectName}",
});`;
};

export function TypeScriptProjectGuide(props: PythonProjectGuideProps) {
  const isHosted = IS_HOSTED_DEPLOYMENT;
  const existingProjectName = props.projectName;
  const projectName = existingProjectName || "your-next-llm-project";
  return (
    <div>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Setup OpenTelemetry
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Configure{" "}
          <ExternalLink href={PHOENIX_OTEL_DOC_LINK}>
            OpenTelemetry
          </ExternalLink>{" "}
          to send traces to Phoenix.
        </Text>
      </View>
      <View paddingTop="size-200" paddingBottom="size-100">
        <TypeScriptPlatformIntegrations />
      </View>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Setup your Environment
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Set the authentication headers in the environment variable{" "}
          <b>OTEL_EXPORTER_OTLP_HEADERS</b>. See{" "}
          <ExternalLink
            href={
              "https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/#otel_exporter_otlp_traces_headers"
            }
          >
            environment variables
          </ExternalLink>
        </Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy
          value={
            isHosted
              ? `OTEL_EXPORTER_OTLP_HEADERS='<auth-headers>'`
              : `OTEL_EXPORTER_OTLP_HEADERS='Authorization=Bearer <your-api-key>'`
          }
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
          Set the Project Name
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Set the project name for your app in the <b>Resource Attributes</b>.
        </Text>
      </View>
      <View paddingBottom="size-100">
        <CodeWrap>
          <PythonBlockWithCopy
            value={
              "npm install @arizeai/openinference-semantic-conventions --save"
            }
          />
        </CodeWrap>
      </View>
      <View paddingBottom="size-100">
        <CodeWrap>
          <TypeScriptBlockWithCopy value={getSetProjectNameCode(projectName)} />
        </CodeWrap>
      </View>
      <View paddingBottom={"size-100"}>
        <Text>
          Add the resources to the NodeJS SDK or Vercel OTEL registration. See{" "}
          <ExternalLink
            href={"https://opentelemetry.io/docs/languages/js/resources/"}
          >
            resources
          </ExternalLink>{" "}
          for details.
        </Text>
      </View>

      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Setup Instrumentation
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Add instrumentation to your application so that your application code
          is traces.
        </Text>
      </View>
      <View paddingBottom="size-100">
        <TypeScriptIntegrations />
      </View>
    </div>
  );
}
