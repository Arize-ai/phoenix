import React, { useState } from "react";

import { Heading, Text, TextField, View } from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { BASE_URL, HOSTED_PHOENIX_URL, IS_HOSTED } from "@phoenix/config";

const PHOENIX_OTEL_DOC_LINK =
  "https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing";
const OTEL_DOC_LINK =
  "https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing/setup-tracing-python/using-otel-python-directly";
const PHOENIX_ENVIRONMENT_VARIABLES_LINK =
  "https://docs.arize.com/phoenix/setup/configuration";

const INSTALL_PHOENIX_OTEL_PYTHON = `pip install arize-phoenix-otel`;

// Environment variables
const HOSTED_PHOENIX_ENVIRONMENT_VARIABLES_PYTHON = `PHOENIX_CLIENT_HEADERS='api_key=<your-api-key>'\nPHOENIX_COLLECTOR_ENDPOINT='${HOSTED_PHOENIX_URL}'`;
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
  endpoint="${(isHosted ? HOSTED_PHOENIX_URL : BASE_URL) + "/v1/traces"}",${isHosted ? `\n  headers={"api_key": "<your-api-key>"}` : ""}
)`;
};

export function PythonNewProjectGuide() {
  const isHosted = IS_HOSTED;
  const [projectName, setProjectName] = useState<string>(
    "your-next-llm-project"
  );
  return (
    <div>
      <View paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Install Dependencies
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          The Phoenix OTEL package makes it easy to send traces to Phoenix.
        </Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={INSTALL_PHOENIX_OTEL_PYTHON} />
      </CodeWrap>
      <View paddingBottom="size-100" paddingTop="size-100">
        <Text>
          Note that you can use OpenTelemetry packages directly as well. See{" "}
          <ExternalLink href={OTEL_DOC_LINK}>documentation</ExternalLink>
        </Text>
      </View>
      <View paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Setup your Environment
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          <b>arize-phoenix-otel</b> automatically picks up your configuration
          from environment variables. Some notable configuration options include
          things like <b>PHOENIX_CLIENT_HEADERS</b> and the{" "}
          <b>PHOENIX_COLLECTOR_ENDPOINT</b>. For a full list of configuration
          options, see the{" "}
          <ExternalLink href={PHOENIX_ENVIRONMENT_VARIABLES_LINK}>
            documentation
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
      <View paddingTop="size-100" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Setup OpenTelemetry
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Register your application to send traces to this project. Note that
          the below sends traces over gRPC but traces can be sent over HTTP as
          well.
        </Text>
      </View>
      <View paddingBottom="size-200">
        <TextField
          label="Project Name"
          value={projectName}
          onChange={setProjectName}
        />
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
            Note that the above uses HTTP to send traces with no batching
            enabled. In production, we recommend using gRPC with batching
            enabled. For more information, see the{" "}
            <ExternalLink href={PHOENIX_OTEL_DOC_LINK}>
              documentation
            </ExternalLink>
            .
          </Text>
        </View>
      ) : null}
    </div>
  );
}
