import { ReactNode, useCallback, useMemo, useState } from "react";

import { Dialog, DialogContainer } from "@arizeai/components";

import {
  Button,
  ExternalLink,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { IsAdmin, IsAuthenticated } from "@phoenix/components/auth";
import { CodeLanguage, CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { TypeScriptBlockWithCopy } from "@phoenix/components/code/TypeScriptBlockWithCopy";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";

const INSTALL_PHOENIX_PYTHON = `pip install arize-phoenix>=${window.Config.platformVersion}`;
// TODO: plumb though session URL from the backend
function getSetBaseUrlPython({ isAuthEnabled }: { isAuthEnabled: boolean }) {
  let setBaseURLPython =
    `import os\n` +
    `# Set the phoenix collector endpoint. Commonly http://localhost:6006 \n` +
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
  `    return f"Hello {example.input['person']}"`;

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

function getDatasetTypeScriptCode(datasetId: string, experimentName: string) {
  return `import { createClient } from "@arizeai/phoenix-client";
import {
  asEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import type { Example } from "@arizeai/phoenix-client/types/datasets";
import OpenAI from "openai";

const phoenix = createClient();
const openai = new OpenAI();

/** Your AI Task  */
const task = async (example: Example) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: JSON.stringify(example.input, null, 2) },
    ],
  });
  return response.choices[0]?.message?.content ?? "No response";
};

/** Exact match evaluator */
const exactMatch = asEvaluator({
  name: "Exact Match",
  kind: "custom",
  evaluate: async ({ input, output, expected }) => {
    return {
      score: output === expected ? 1.0 : 0.0,
      label: output === expected ? "match" : "no_match",
      explanation: "Expected: " + expected + ", Got: " + output,
      metadata: {},
    };
  },
});

await runExperiment({
  dataset: "${datasetId}",
  experimentName: "${experimentName}",
  client: phoenix,
  task,
  evaluators: [exactMatch],
});`;
}

function RunExperimentPythonExample() {
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
    <View overflow="auto">
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
              <ExternalLink href="/settings/general">Settings</ExternalLink>
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

function RunExperimentTypeScriptExample() {
  const datasetName = useDatasetContext((state) => state.datasetName);
  // You could add experimentName state or prop if needed
  return (
    <View overflow="auto">
      <View paddingBottom="size-100">
        <Text>Install Phoenix Client</Text>
      </View>
      <CodeWrap>
        <TypeScriptBlockWithCopy
          value={`npm install @arizeai/phoenix-client`}
        />
      </CodeWrap>
      <View paddingTop="size-100" paddingBottom="size-100">
        <Text>Run an experiment</Text>
      </View>
      <CodeWrap>
        <TypeScriptBlockWithCopy
          value={getDatasetTypeScriptCode(datasetName, "experiment_name")}
        />
      </CodeWrap>
    </View>
  );
}

function RunExperimentExampleSwitcher() {
  const [language, setLanguage] = useState<CodeLanguage>("Python");
  return (
    <Dialog title="Run Experiment" size="XL">
      <View padding="size-400" overflow="auto">
        <View paddingBottom="size-200">
          <CodeLanguageRadioGroup language={language} onChange={setLanguage} />
        </View>
        {language === "Python" ? (
          <RunExperimentPythonExample />
        ) : (
          <RunExperimentTypeScriptExample />
        )}
      </View>
    </Dialog>
  );
}

export function RunExperimentButton() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  const onRunExample = useCallback(() => {
    setDialog(<RunExperimentExampleSwitcher />);
  }, []);
  return (
    <>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.ExperimentOutline />} />}
        onPress={onRunExample}
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
