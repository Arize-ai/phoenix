import { fetchQuery, graphql } from "react-relay";

import { inferIncludeExplanationFromPrompt } from "@phoenix/components/evaluators/utils";
import type { TemplateFormat } from "@phoenix/components/templateEditor/types";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import type { AnnotationConfig } from "@phoenix/store/evaluatorStore";
import type {
  PlaygroundEvaluatorTask,
  PlaygroundEvaluatorTaskSource,
  PlaygroundEvaluatorTaskKind,
  PlaygroundInstance,
  PlaygroundInstanceLoadingSource,
} from "@phoenix/store/playground";
import {
  createEvaluatorTaskInstance,
  createPlaygroundEvaluatorTask,
} from "@phoenix/store/playground";

import type { fetchPlaygroundEvaluatorQuery } from "./__generated__/fetchPlaygroundEvaluatorQuery.graphql";
import {
  promptVersionToInstance,
  readPlaygroundPromptVersion,
} from "./fetchPlaygroundPrompt";

/**
 * An evaluator as the playground loads it into a task, whether it was
 * named directly or through a dataset binding. The update mutations of the
 * evaluator save return the same shape so a later load reads fresh data
 * from the Relay store.
 */
export const fetchPlaygroundEvaluatorSourceFragment = graphql`
  fragment fetchPlaygroundEvaluator_source on Evaluator {
    id
    name
    description
    kind
    isBuiltin
    outputConfigs {
      ...fetchPlaygroundEvaluator_output @relay(mask: false)
    }
    ... on LLMEvaluator {
      prompt {
        id
        name
      }
      promptVersion {
        id
        templateFormat
        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
      }
      promptVersionTag {
        name
      }
    }
    ... on CodeEvaluator {
      language
      sourceCode
      sandboxConfig {
        id
      }
      inputMapping {
        literalMapping
        pathMapping
      }
    }
  }
`;

export const fetchPlaygroundEvaluatorDatasetEvaluatorFragment = graphql`
  fragment fetchPlaygroundEvaluator_datasetEvaluator on DatasetEvaluator {
    id
    name
    dataset {
      id
    }
    inputMapping {
      literalMapping
      pathMapping
    }
    outputConfigs {
      ...fetchPlaygroundEvaluator_output @relay(mask: false)
    }
    evaluator {
      ...fetchPlaygroundEvaluator_source @relay(mask: false)
    }
  }
`;

export const fetchPlaygroundEvaluatorProjectEvaluatorFragment = graphql`
  fragment fetchPlaygroundEvaluator_projectEvaluator on ProjectEvaluator {
    id
    name
    inputMapping {
      literalMapping
      pathMapping
    }
    evaluator {
      ...fetchPlaygroundEvaluator_source @relay(mask: false)
    }
  }
`;

export const fetchPlaygroundEvaluatorOutputFragment = graphql`
  fragment fetchPlaygroundEvaluator_output on BuiltInEvaluatorOutputConfig {
    __typename
    ... on CategoricalAnnotationConfig {
      name
      optimizationDirection
      values {
        label
        score
      }
    }
    ... on ContinuousAnnotationConfig {
      name
      optimizationDirection
      lowerBound
      upperBound
    }
    ... on FreeformAnnotationConfig {
      name
      optimizationDirection
      threshold
      lowerBound
      upperBound
    }
  }
`;

const fetchPlaygroundEvaluatorQueryNode = graphql`
  query fetchPlaygroundEvaluatorQuery($id: ID!) {
    node(id: $id) {
      ... on Evaluator {
        ...fetchPlaygroundEvaluator_source @relay(mask: false)
      }
      ... on DatasetEvaluator {
        ...fetchPlaygroundEvaluator_datasetEvaluator @relay(mask: false)
      }
      ... on ProjectEvaluator {
        ...fetchPlaygroundEvaluator_projectEvaluator @relay(mask: false)
      }
    }
  }
`;

type EvaluatorNode = fetchPlaygroundEvaluatorQuery["response"]["node"];

/** The shared evaluator's fields, on the node itself or under a binding. */
type EvaluatorSource = EvaluatorNode | NonNullable<EvaluatorNode["evaluator"]>;

type OutputConfigNode = NonNullable<EvaluatorNode["outputConfigs"]>[number];

/** The evaluator's outputs in the evaluator store's shape. */
export function toEvaluatorTaskOutputConfigs(
  configs: ReadonlyArray<OutputConfigNode>
): AnnotationConfig[] {
  return configs.flatMap((config): AnnotationConfig[] => {
    if (config.__typename === "CategoricalAnnotationConfig") {
      return [
        {
          name: config.name,
          optimizationDirection: config.optimizationDirection,
          values: config.values.map((value) => ({
            label: value.label,
            score: value.score ?? undefined,
          })),
        },
      ];
    }

    if (config.__typename === "ContinuousAnnotationConfig") {
      return [
        {
          name: config.name,
          optimizationDirection: config.optimizationDirection,
          lowerBound: config.lowerBound,
          upperBound: config.upperBound,
        },
      ];
    }

    if (config.__typename === "FreeformAnnotationConfig") {
      return [
        {
          name: config.name,
          optimizationDirection: config.optimizationDirection,
          lowerBound: config.lowerBound,
          upperBound: config.upperBound,
          threshold: config.threshold,
        },
      ];
    }

    return [];
  });
}

function getEditableKind(
  source: EvaluatorSource | null | undefined
): PlaygroundEvaluatorTaskKind | null {
  if (!source?.id || source.isBuiltin) {
    return null;
  }

  return source.kind === "LLM" || source.kind === "CODE" ? source.kind : null;
}

export type FetchedPlaygroundEvaluator = {
  instance: Omit<PlaygroundInstance, "id">;
  /** The judge prompt's format for an LLM evaluator; null for code. */
  templateFormat: TemplateFormat | null;
};

/** Where the task came from: the shared evaluator, and the binding if the node is one. */
function buildTaskSource({
  node,
  evaluator,
  binding,
}: {
  node: NonNullable<EvaluatorNode>;
  evaluator: EvaluatorSource;
  binding: "datasetEvaluator" | "projectEvaluator" | null;
}): PlaygroundEvaluatorTaskSource {
  return {
    evaluatorId: evaluator.id ?? null,
    datasetEvaluatorId:
      binding === "datasetEvaluator" ? (node.id ?? null) : null,
    projectEvaluatorId:
      binding === "projectEvaluator" ? (node.id ?? null) : null,
  };
}

/** The evaluator draft a fetched node stands for. */
function buildEvaluatorTask({
  node,
  evaluator,
  kind,
  binding,
}: {
  node: NonNullable<EvaluatorNode>;
  evaluator: EvaluatorSource;
  kind: PlaygroundEvaluatorTaskKind;
  /** Which binding the node is, when it is one rather than the evaluator itself. */
  binding: "datasetEvaluator" | "projectEvaluator" | null;
}): PlaygroundEvaluatorTask {
  const outputConfigs = toEvaluatorTaskOutputConfigs(
    node.outputConfigs ?? evaluator.outputConfigs ?? []
  );

  const judgePromptVersion =
    kind === "LLM" && evaluator.promptVersion
      ? readPlaygroundPromptVersion(evaluator.promptVersion)
      : null;

  const task = createPlaygroundEvaluatorTask({
    kind,
    name: evaluator.name ?? "",
    description: evaluator.description ?? "",
    inputMapping: node.inputMapping ??
      evaluator.inputMapping ?? { literalMapping: {}, pathMapping: {} },
    includeExplanation: judgePromptVersion
      ? inferIncludeExplanationFromPrompt(judgePromptVersion.tools)
      : true,
    code:
      kind === "CODE"
        ? {
            language: evaluator.language ?? "PYTHON",
            sourceCode: evaluator.sourceCode ?? "",
            sandboxConfigId: evaluator.sandboxConfig?.id ?? null,
          }
        : null,
    source: buildTaskSource({ node, evaluator, binding }),
  });

  // A saved evaluator with no outputs keeps the draft's default output.
  return outputConfigs.length ? { ...task, outputConfigs } : task;
}

/**
 * The judge prompt as the instance's template, model and prompt reference,
 * over the draft's defaults; null when the evaluator has no prompt.
 */
function buildJudgeInstance(
  evaluator: EvaluatorSource,
  draft: Omit<PlaygroundInstance, "id">
): {
  instance: Omit<PlaygroundInstance, "id">;
  templateFormat: TemplateFormat;
} | null {
  if (!evaluator.prompt || !evaluator.promptVersion) {
    return null;
  }

  const judge = promptVersionToInstance({
    promptId: evaluator.prompt.id,
    promptName: evaluator.prompt.name,
    promptVersionRef: evaluator.promptVersion,
    promptVersionTag: evaluator.promptVersionTag?.name ?? null,
  });

  return {
    instance: {
      ...draft,
      ...judge,
      // A judge always answers through its output tool, whatever the saved
      // version says.
      toolChoice: draft.toolChoice,
      task: draft.task,
    },
    // SAFETY: Relay widens the schema's TemplateFormat enum with
    // "%future added value"; a saved prompt version always carries a known
    // format.
    templateFormat: evaluator.promptVersion.templateFormat as TemplateFormat,
  };
}

/**
 * Fetches a saved LLM or code evaluator, by evaluator id or by dataset or
 * project evaluator id, as a playground instance. A binding's own input
 * mapping is what the task carries, so what is calibrated is what runs. An LLM evaluator's judge prompt
 * becomes the instance's template, model and prompt reference; a code
 * evaluator's code lands on the task. Resolves null for built-in, deleted
 * or otherwise uneditable evaluators.
 */
export async function fetchPlaygroundEvaluatorAsInstance(
  source: Extract<
    PlaygroundInstanceLoadingSource,
    { type: "evaluator" | "datasetEvaluator" | "projectEvaluator" }
  >
): Promise<FetchedPlaygroundEvaluator | null> {
  const id =
    source.type === "evaluator"
      ? source.evaluatorId
      : source.type === "datasetEvaluator"
        ? source.datasetEvaluatorId
        : source.projectEvaluatorId;

  const data = await fetchQuery<fetchPlaygroundEvaluatorQuery>(
    RelayEnvironment,
    fetchPlaygroundEvaluatorQueryNode,
    { id }
  ).toPromise();

  const node = data?.node;

  if (!node) {
    return null;
  }

  // A dataset or project evaluator binds a shared evaluator; the binding's
  // own mapping (and, for a dataset evaluator, outputs) win over the
  // evaluator's.
  const evaluator: EvaluatorSource = node.evaluator ?? node;
  const kind = getEditableKind(evaluator);

  if (!kind) {
    return null;
  }

  const binding =
    node.evaluator == null
      ? null
      : source.type === "projectEvaluator"
        ? "projectEvaluator"
        : "datasetEvaluator";

  const draft: Omit<PlaygroundInstance, "id"> = {
    ...createEvaluatorTaskInstance({ kind }),
    task: {
      kind: "evaluator",
      evaluator: buildEvaluatorTask({ node, evaluator, kind, binding }),
    },
  };

  return (
    (kind === "LLM" ? buildJudgeInstance(evaluator, draft) : null) ?? {
      instance: draft,
      templateFormat: null,
    }
  );
}
