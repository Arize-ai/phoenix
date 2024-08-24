import React, { ReactNode, useState } from "react";

import {
  Button,
  Dialog,
  DialogContainer,
  Icon,
  Icons,
  Text,
  View,
} from "@arizeai/components";

import { ExternalLink } from "@phoenix/components";

import { PythonNewProjectGuide } from "./PythonNewProjectGuide";

const PHOENIX_OTEL_DOC_LINK =
  "https://docs.arize.com/phoenix/tracing/how-to-tracing/setup-tracing";

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

function NewProjectDialog() {
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
            </Text>
          </p>
        </View>
        <PythonNewProjectGuide />
      </View>
    </Dialog>
  );
}
