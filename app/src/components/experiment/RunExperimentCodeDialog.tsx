import { useCallback } from "react";

import {
  Button,
  ButtonProps,
  Dialog,
  DialogTrigger,
  ExternalLink,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { IsAdmin, IsAuthenticated } from "@phoenix/components/auth";
import { CodeLanguageRadioGroup } from "@phoenix/components/code";
import { CodeWrap } from "@phoenix/components/code/CodeWrap";
import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { TypeScriptBlockWithCopy } from "@phoenix/components/code/TypeScriptBlockWithCopy";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { ExperimentCodeModal } from "@phoenix/components/experiment/ExperimentCodeModal";
import { BASE_URL } from "@phoenix/config";
import { usePreferencesContext } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";

const INSTALL_PHOENIX_PYTHON = `pip install arize-phoenix-client`;

function getSetBaseUrlPython({ isAuthEnabled }: { isAuthEnabled: boolean }) {
  let setBaseURLPython =
    `import os\n` +
    `# Set the phoenix base url to point to your Phoenix instance \n` +
    `os.environ["PHOENIX_BASE_URL"] = "${BASE_URL}"`;
  if (isAuthEnabled) {
    setBaseURLPython +=
      `\n` +
      `# Configure access\n` +
      `os.environ["PHOENIX_API_KEY"] = "<your-api-key>"`;
  }
  return setBaseURLPython;
}

const TASK_PYTHON =
  `# Define your task\n` +
  `# Typically should be an LLM call or a call to invoke your application\n` +
  `def my_task(example):\n` +
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
  `from phoenix.client.experiments import run_experiment\n\n` +
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
  dataset: { datasetId: "${datasetId}" },
  experimentName: "${experimentName}",
  client: phoenix,
  task,
  evaluators: [exactMatch],
});`;
}

export type DatasetVersion = {
  id: string;
};

export type RunExperimentCodeDialogProps = {
  /**
   * The name of the dataset to run the experiment on
   */
  datasetName: string;
  /**
   * The ID of the dataset (used for TypeScript example)
   */
  datasetId: string;
  /**
   * Optional specific version of the dataset
   */
  version?: DatasetVersion | null;
};

function RunExperimentPythonExample({
  datasetName,
  version,
}: Pick<RunExperimentCodeDialogProps, "datasetName" | "version">) {
  const isAuthEnabled = window.Config.authenticationEnabled;

  const getDatasetPythonCode = useCallback(() => {
    return (
      `from phoenix.client import Client\n` +
      `# Initialize a phoenix client\n` +
      `client = Client()\n` +
      `# Get the current dataset version. You can omit the version for the latest.\n` +
      `dataset = client.datasets.get_dataset(dataset="${datasetName}"${version ? `, version_id="${version.id}"` : ""})`
    );
  }, [datasetName, version]);

  return (
    <View overflow="auto">
      <View paddingBottom="size-100">
        <Text>Install the Phoenix Client</Text>
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
        <PythonBlockWithCopy value={getDatasetPythonCode()} />
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

function RunExperimentTypeScriptExample({
  datasetId,
}: Pick<RunExperimentCodeDialogProps, "datasetId">) {
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
          value={getDatasetTypeScriptCode(datasetId, "experiment_name")}
        />
      </CodeWrap>
    </View>
  );
}

/**
 * Dialog content showing code examples for running experiments via the SDK.
 * Use inside a Modal component.
 */
export function RunExperimentCodeDialogContent({
  datasetName,
  datasetId,
  version,
}: RunExperimentCodeDialogProps) {
  const { programmingLanguage, setProgrammingLanguage } = usePreferencesContext(
    (state) => ({
      programmingLanguage: state.programmingLanguage,
      setProgrammingLanguage: state.setProgrammingLanguage,
    })
  );
  let codeExampleEl: React.ReactNode;
  if (programmingLanguage === "Python") {
    codeExampleEl = (
      <RunExperimentPythonExample datasetName={datasetName} version={version} />
    );
  } else if (programmingLanguage === "TypeScript") {
    codeExampleEl = <RunExperimentTypeScriptExample datasetId={datasetId} />;
  } else {
    assertUnreachable(programmingLanguage);
  }

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Experiment</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-400" overflow="auto">
          <View paddingBottom="size-200">
            <CodeLanguageRadioGroup
              language={programmingLanguage}
              onChange={setProgrammingLanguage}
            />
          </View>
          {codeExampleEl}
        </View>
      </DialogContent>
    </Dialog>
  );
}

export type RunExperimentButtonProps = RunExperimentCodeDialogProps &
  Pick<ButtonProps, "variant" | "size">;

/**
 * A button that opens a dialog with code examples for running experiments
 * on a dataset via the Python or TypeScript SDK.
 */
export function RunExperimentButton({
  datasetName,
  datasetId,
  version,
  variant = "default",
  size = "S",
}: RunExperimentButtonProps) {
  return (
    <DialogTrigger>
      <Button
        size={size}
        variant={variant}
        leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
      >
        Experiment
      </Button>
      <ExperimentCodeModal
        datasetName={datasetName}
        datasetId={datasetId}
        version={version}
      />
    </DialogTrigger>
  );
}
