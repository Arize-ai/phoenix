import React from "react";

import { Heading, Text, View } from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";

import { TypeScriptBlockWithCopy } from "../code/TypeScriptBlockWithCopy";

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
          If authentication is enabled, set the{" "}
          <b>OTEL_EXPORTER_OTLP_TRACES_HEADERS</b>. See{" "}
          <ExternalLink
            href={
              "https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/#otel_exporter_otlp_traces_headers"
            }
          >
            environment variable
          </ExternalLink>
        </Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy
          value={`OTEL_EXPORTER_OTLP_TRACES_HEADERS='<auth-headers>'`}
        />
      </CodeWrap>
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
