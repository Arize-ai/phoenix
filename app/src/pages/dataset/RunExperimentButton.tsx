import React, { ReactNode, useCallback, useMemo, useState } from "react";

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
import { IsAdmin, IsAuthenticated } from "@phoenix/components/auth";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

const INSTALL_PHOENIX_PYTHON = `pip install arize-phoenix>=${window.Config.platformVersion}`;
// TODO: plumb though session URL from the backend
function getSetBaseUrlPython({ isAuthEnabled }: { isAuthEnabled: boolean }) {
  let setBaseURLPython =
    `import os\n` +
    `# Set the phoenix collector endpoint. Commonly http://localhost:6060 \n` +
    `os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "<your-phoenix-url>"`;
  if (isAuthEnabled) {
    setBaseURLPython +=
      `\n` +
      `# Configure access\n` +
      `os.environ["PHOENIX_API_KEY"] = "<your-api-key>"`;
  }
  return setBaseURLPython;
}
const TASK_PYTHON =
  `from phoenix.experiments.types import Example\n` +
  `# Define your task\n` +
  `# Typically should be an LLM call or a call to your application\n` +
  `def my_task(example: Example) -> str:\n` +
  `    # This is just an example of how to return a JSON serializable value\n` +
  `    return f"Hello {example.input["person"]}"`;

const EVALUATOR_PYTHON =
  `# Define an evaluator. This just an example.\n` +
  `def exact_match(input, output) -> float:\n` +
  `    return 1.0 if output is f"Hello {input}" else 0.0\n\n` +
  `# Store the evaluators for later use\n` +
  `evaluators = [exact_match]`;

const RUN_EXPERIMENT_PYTHON =
  `# Run an experiment\n` +
  `from phoenix.experiments import run_experiment\n\n` +
  `experiment = run_experiment(dataset, my_task, evaluators=evaluators)`;

export function RunExperimentButton() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onRunExample = useCallback(() => {
    setDialog(
      <Dialog title="Run Experiment" size="XL">
        <RunExperimentExample />
      </Dialog>
    );
  }, []);
  return (
    <>
      <Button
        size="compact"
        variant="default"
        icon={<Icon svg={<Icons.ExperimentOutline />} />}
        onClick={onRunExample}
      >
        Run Experiment
      </Button>
      <DialogContainer
        isDismissable
        type="slideOver"
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}

function RunExperimentExample() {
  const datasetName = useDatasetContext((state) => state.datasetName);
  const version = useDatasetContext((state) => state.latestVersion);
  const isAuthEnabled = window.Config.authenticationEnabled;

  const getDatasetPythonCode = useMemo(() => {
    return (
      `import phoenix as px\n` +
      `# Initialize a phoenix client\n` +
      `client = px.Client()\n` +
      `# Get the current dataset version. You can omit the version for the latest.\n` +
      `dataset = client.get_dataset(name="${datasetName}"${version ? `, version_id="${version.id}"` : ""})`
    );
  }, [datasetName, version]);

  return (
    <View padding="size-400" overflow="auto">
      <View paddingBottom="size-100">
        <Text>Install Phoenix</Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={INSTALL_PHOENIX_PYTHON} />
      </CodeWrap>
      <View paddingTop="size-100" paddingBottom="size-100">
        <Text>Point to a running instance of Phoenix</Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={getSetBaseUrlPython({ isAuthEnabled })} />
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
              <ExternalLink href="/settings">Settings</ExternalLink>
            </Text>
          </IsAdmin>
        </View>
      </IsAuthenticated>
      <View paddingTop="size-100" paddingBottom="size-100">
        <Text>Pull down this dataset</Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={getDatasetPythonCode} />
      </CodeWrap>
      <View paddingTop="size-100" paddingBottom="size-100">
        <Text>Define your task</Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={TASK_PYTHON} />
      </CodeWrap>
      <View paddingTop="size-100" paddingBottom="size-100">
        <Text>Define evaluators</Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={EVALUATOR_PYTHON} />
      </CodeWrap>
      <View paddingTop="size-100" paddingBottom="size-100">
        <Text>Run an experiment</Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={RUN_EXPERIMENT_PYTHON} />
      </CodeWrap>
    </View>
  );
}
