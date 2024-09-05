import React from "react";

import {
  Heading,
  TabbedCard,
  TabPane,
  Tabs,
  Text,
  View,
} from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { BASE_URL } from "@phoenix/config";

import { PythonIntegrations } from "./Integrations";

const PHOENIX_OTEL_DOC_LINK =
  "https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing";

const OTEL_DOC_LINK =
  "https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing/setup-tracing-python/using-otel-python-directly";
const PHOENIX_ENVIRONMENT_VARIABLES_LINK =
  "https://docs.arize.com/phoenix/setup/configuration";

const INSTALL_PHOENIX_OTEL_PYTHON = `pip install arize-phoenix-otel`;
const INSTALL_OPENAI_INSTRUMENTATION_PYTHON = `pip install openinference-instrumentation-openai openai`;

const HOSTED_PHOENIX_URL = "https://app.phoenix.arize.com";
const LLAMATRACE_URL = "https://llamatrace.com";

const HOSTED_BASE_URLS = [HOSTED_PHOENIX_URL, LLAMATRACE_URL];

// Environment variables
const HOSTED_PHOENIX_ENVIRONMENT_VARIABLES_PYTHON = `PHOENIX_CLIENT_HEADERS='api_key=<your-api-key>'\nPHOENIX_COLLECTOR_ENDPOINT='${HOSTED_PHOENIX_URL}'`;

const INSTRUMENT_OPENAI_PYTHON = `from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)`;
const OPENAI_CHAT_PYTHON = `import os
from openai import OpenAI

client = OpenAI(
    # This is the default and can be omitted
    api_key=os.environ.get("OPENAI_API_KEY"),
)

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": "Say this is a test",
        }
    ],
    model="gpt-3.5-turbo",
)`;
const getOtelInitCodePython = ({
  isHosted,
  projectName,
}: {
  isHosted: boolean;
  projectName: string;
}) => {
  return `from phoenix.otel import register\n
tracer_provider = register(
  project_name="${projectName}",
  endpoint="${(isHosted ? HOSTED_PHOENIX_URL : BASE_URL) + "/v1/traces"}"
)`;
};

type PythonProjectGuideProps = {
  /**
   * An existing project name
   */
  projectName?: string;
};
export function PythonProjectGuide(props: PythonProjectGuideProps) {
  const isHosted = HOSTED_BASE_URLS.includes(BASE_URL);

  const projectName = props.projectName || "your-next-llm-project";
  return (
    <div>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Install Dependencies
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Use the Phoenix OTEL or{" "}
          <ExternalLink href={OTEL_DOC_LINK}>OpenTelemetry</ExternalLink> to
          configure your application to send traces to Phoenix.
        </Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={INSTALL_PHOENIX_OTEL_PYTHON} />
      </CodeWrap>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Setup your Environment
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          <b>arize-phoenix-otel</b> automatically picks up your configuration
          from environment variables (e.x. <b>PHOENIX_CLIENT_HEADERS</b> for
          authentication). See{" "}
          <ExternalLink href={PHOENIX_ENVIRONMENT_VARIABLES_LINK}>
            environment variables
          </ExternalLink>
        </Text>
      </View>
      {isHosted ? (
        <CodeWrap>
          <PythonBlockWithCopy
            value={HOSTED_PHOENIX_ENVIRONMENT_VARIABLES_PYTHON}
          />
        </CodeWrap>
      ) : null}
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Setup OpenTelemetry
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Register your application to send traces to this project. The code
          below should be added <b>BEFORE</b> any code execution.
        </Text>
      </View>
      <View paddingBottom="size-100">
        <CodeWrap>
          <PythonBlockWithCopy
            value={getOtelInitCodePython({ projectName, isHosted })}
          />
        </CodeWrap>
      </View>
      {!isHosted ? (
        <View paddingBottom="size-100">
          <Text>
            To configure gRPC and batching, see our{" "}
            <ExternalLink href={PHOENIX_OTEL_DOC_LINK}>
              setup guide
            </ExternalLink>
            .
          </Text>
        </View>
      ) : null}
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
      <TabbedCard variant="compact">
        <Tabs>
          <TabPane name="Instrumentation">
            <View padding="size-200">
              <Text>
                Trace your application using{" "}
                <ExternalLink href="https://github.com/Arize-ai/openinference">
                  OpenInference
                </ExternalLink>{" "}
                instrumentation and OpenTelemetry
              </Text>
              <View paddingTop="size-200" paddingBottom="size-200">
                <PythonIntegrations />
              </View>
              <Text>
                For more integrations, checkout our{" "}
                <ExternalLink href="https://docs.arize.com/phoenix/tracing/integrations-tracing">
                  comprehensive guide
                </ExternalLink>
              </Text>
            </View>
          </TabPane>
          <TabPane name="OpenAI Example">
            <View padding="size-200">
              <p>
                Install{" "}
                <ExternalLink href="https://github.com/Arize-ai/openinference">
                  OpenInference
                </ExternalLink>{" "}
                instrumentation as well as <b>openai</b>
              </p>
              <CodeWrap>
                <PythonBlockWithCopy
                  value={INSTALL_OPENAI_INSTRUMENTATION_PYTHON}
                />
              </CodeWrap>
              <p>
                Instrument <b>openai</b> at the beginning of your code
              </p>
              <View paddingBottom="size-50">
                <CodeWrap>
                  <PythonBlockWithCopy value={INSTRUMENT_OPENAI_PYTHON} />
                </CodeWrap>
              </View>
              <p>
                Use <b>openai</b> as you normally and traces will be sent to
                Phoenix
              </p>
              <View paddingBottom="size-50">
                <CodeWrap>
                  <PythonBlockWithCopy value={OPENAI_CHAT_PYTHON} />
                </CodeWrap>
              </View>
            </View>
          </TabPane>
        </Tabs>
      </TabbedCard>
    </div>
  );
}
