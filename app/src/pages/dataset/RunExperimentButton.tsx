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

import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

const INSTALL_PHOENIX_PYTHON = `!pip install arize-phoenix==${window.Config.platformVersion}`;
// TODO: plumb though session URL from the backend
const SET_BASE_URL_PYTHON =
  `import os\n` +
  `# Set the phoenix collector endpoint. Commonly http://localhost:6060 \n` +
  `os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "<your-phoenix-url>"`;
const TASK_PYTHON =
  `from phoenix.datasets.types import Example\n` +
  `# Define your task\n` +
  `# Typically should be an LLM call or a call to your application\n` +
  `def my_task(example: Example) -> str:\n` +
  `    return f"Hello {example.input}"`;

const EVALUATOR_PYTHON =
  `# Define an evaluator. This just an example.\n` +
  `def exact_match(input, output) -> float:\n` +
  `    return 1.0 if output is f"Hello {input}" else 0.0\n\n` +
  `# Store the evaluators for later use\n` +
  `evaluators = [exact_match]`;

const RUN_EXPERIMENT_PYTHON =
  `# Run an experiment\n` +
  `from phoenix.datasets.experiments import run_experiment\n\n` +
  `experiment = run_experiment(dataset=dataset, task=my_task, evaluators=evaluators)`;

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
        icon={<Icon svg={<Icons.PlayCircleOutline />} />}
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
    <View padding="size-400">
      <View paddingBottom="size-100">
        <Text>Install phoenix</Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={INSTALL_PHOENIX_PYTHON} />
      </CodeWrap>
      <View paddingTop="size-100" paddingBottom="size-100">
        <Text>Make sure to point this phoenix instance</Text>
      </View>
      <CodeWrap>
        <PythonBlockWithCopy value={SET_BASE_URL_PYTHON} />
      </CodeWrap>
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

function CodeWrap({ children }: { children: ReactNode }) {
  return (
    <View borderColor="light" borderWidth="thin" borderRadius="small">
      {children}
    </View>
  );
}
