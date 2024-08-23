import React, { ReactNode, useState } from "react";

import {
  Button,
  Dialog,
  DialogContainer,
  Heading,
  Icon,
  Icons,
  Text,
  TextField,
  View,
} from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { IS_HOSTED } from "@phoenix/config";

const PHOENIX_OTEL_DOC_LINK =
  "https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing";
const OTEL_DOC_LINK =
  "https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing/setup-tracing-python/using-otel-python-directly";
const PHOENIX_ENVIRONMENT_VARIABLES_LINK =
  "https://docs.arize.com/phoenix/setup/configuration";

export function NewProjectButton() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  return (
    <div>
      <Button
        variant="default"
        icon={<Icon svg={<Icons.GridOutline />} />}
        onClick={() => {
          setDialog(<NewProjectDialog />);
        }}
      >
        New Project
      </Button>
      <DialogContainer
        isDismissable
        type="slideOver"
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}

const INSTALL_PHOENIX_OTEL_PYTHON = `pip install arize-phoenix-otel`;
const HOSTED_PHOENIX_ENVIRONMENT_VARIABLES_PYTHON = `PHOENIX_CLIENT_HEADERS='api_key=<your-api-key>'`;
const getOtelInitCodePython = (projectName: string) => {
  return `from phoenix.otel import register\n
tracer_provider = register(
  project_name="${projectName}",
    endpoint="http://<your-phoenix>:4317", # or gRPC at "http://<your-phoenix>:4317"
    headers={"api_key": "<your-api-key>"}, # E.x. credentials
)`;
};

function NewProjectDialog() {
  const [projectName, setProjectName] = useState("your-project-name");
  return (
    <Dialog title="Create a New Project" size="L">
      <View padding="size-400">
        <View paddingBottom="size-200">
          <Text>
            Projects are automatically created when you log your first span. To
            get started, setup OpenTelemetry as well as instrumentation so that
            traces from your application is sent to Phoenix.
          </Text>
          <p>
            <Text>
              The below guide is specific to Python. For other languages (e.x.
              TypeScript) and a more comprehensive guide on how to instrument
              your application, please refer to the{" "}
              <ExternalLink href={PHOENIX_OTEL_DOC_LINK}>
                documentation
              </ExternalLink>
              .
            </Text>
          </p>
        </View>
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
            from environment variables. Some notable configuration options
            include things like <b>PHOENIX_CLIENT_HEADERS</b> and the{" "}
            <b>PHOENIX_COLLECTOR_ENDPOINT</b>. For a full list of configuration
            options, see the{" "}
            <ExternalLink href={PHOENIX_ENVIRONMENT_VARIABLES_LINK}>
              documentation
            </ExternalLink>
          </Text>
        </View>
        {IS_HOSTED ? (
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
            <PythonBlockWithCopy value={getOtelInitCodePython(projectName)} />
          </CodeWrap>
        </View>
      </View>
    </Dialog>
  );
}
