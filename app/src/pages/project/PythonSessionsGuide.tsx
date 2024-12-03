import React from "react";

import { Heading, Text, View } from "@arizeai/components";

import { CodeWrap, PythonBlockWithCopy } from "@phoenix/components/code";

const INSTALL_OPENINFERENCE_INSTRUMENTATION_PYTHON = `pip install openinference-instrumentation`;
export function PythonSessionsGuide() {
  return (
    <div>
      <View paddingTop="size-200" paddingBottom="size-100">
        <Heading level={2} weight="heavy">
          Install Dependencies
        </Heading>
      </View>
      <View paddingBottom="size-100">
        <Text>
          Sessions are tracked via the OpenTelemetry attribute <b>session.id</b>
          . The easiest way to get started with sessions is to use the
          OpenInference instrumentation package.
        </Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy
          value={INSTALL_OPENINFERENCE_INSTRUMENTATION_PYTHON}
        />
      </CodeWrap>
    </div>
  );
}
