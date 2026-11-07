/**
 * @generated SignedSource<<149772ccffb65955e7bdb103fb3f8049>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluationTarget = "SESSION" | "SPAN" | "TRACE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type UpdateProjectDecisionEvaluatorInput = {
  decisionVersion?: DecisionVersionInput | null;
  decisionVersionId?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  evaluationDelaySeconds?: number | null;
  evaluationTarget: EvaluationTarget;
  filterCondition: string;
  inputMapping?: EvaluatorInputMappingInput | null;
  name?: string | null;
  projectEvaluatorId: string;
  samplingRate: number;
  scoringPolicy?: DecisionScoringPolicyInput | null;
};
export type EvaluatorInputMappingInput = {
  literalMapping: any;
  pathMapping: any;
};
export type DecisionVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  metadata?: any | null;
  modelName: string;
  modelProvider: GenerativeProviderKey;
  questions: ReadonlyArray<DecisionQuestionInput>;
  state: DecisionStateInput;
  templateFormat: PromptTemplateFormat;
};
export type DecisionStateInput = {
  json?: never;
  text: string;
} | {
  json: any;
  text?: never;
};
export type DecisionQuestionInput = {
  choice?: never;
  predicate: PredicateQuestionInput;
  scale?: never;
} | {
  choice: ChoiceQuestionInput;
  predicate?: never;
  scale?: never;
} | {
  choice?: never;
  predicate?: never;
  scale: ScaleQuestionInput;
};
export type PredicateQuestionInput = {
  criteria?: PredicateCriteriaInput | null;
  instructions: string;
  name: string;
};
export type PredicateCriteriaInput = {
  false?: string | null;
  true?: string | null;
};
export type ChoiceQuestionInput = {
  choices: ReadonlyArray<ChoiceOptionInput>;
  instructions: string;
  name: string;
};
export type ChoiceOptionInput = {
  description?: string | null;
  value: string;
};
export type ScaleQuestionInput = {
  instructions: string;
  levels: ReadonlyArray<ScaleLevelInput>;
  name: string;
};
export type ScaleLevelInput = {
  description?: string | null;
  label: string;
};
export type DecisionScoringPolicyInput = {
  questions?: ReadonlyArray<DecisionQuestionScoringInput>;
};
export type DecisionQuestionScoringInput = {
  choice?: never;
  predicate: DecisionPredicateScoringInput;
  scale?: never;
} | {
  choice: DecisionChoiceScoringInput;
  predicate?: never;
  scale?: never;
} | {
  choice?: never;
  predicate?: never;
  scale: DecisionScaleScoringInput;
};
export type DecisionPredicateScoringInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  threshold?: number;
};
export type DecisionChoiceScoringInput = {
  name: string;
  optimizationDirection?: OptimizationDirection;
  scores?: ReadonlyArray<DecisionChoiceScoreInput>;
};
export type DecisionChoiceScoreInput = {
  choice: string;
  score: number;
};
export type DecisionScaleScoringInput = {
  includeLabel?: boolean;
  name: string;
  optimizationDirection?: OptimizationDirection;
};
export type ProjectDecisionEvaluatorDialogContentUpdateMutation$variables = {
  input: UpdateProjectDecisionEvaluatorInput;
};
export type ProjectDecisionEvaluatorDialogContentUpdateMutation$data = {
  readonly updateProjectDecisionEvaluator: {
    readonly evaluator: {
      readonly enabled: boolean;
      readonly evaluationTarget: EvaluationTarget;
      readonly filterCondition: string;
      readonly id: string;
      readonly name: string;
      readonly samplingRate: number;
    };
  };
};
export type ProjectDecisionEvaluatorDialogContentUpdateMutation = {
  response: ProjectDecisionEvaluatorDialogContentUpdateMutation$data;
  variables: ProjectDecisionEvaluatorDialogContentUpdateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "ProjectEvaluatorMutationPayload",
    "kind": "LinkedField",
    "name": "updateProjectDecisionEvaluator",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ProjectEvaluator",
        "kind": "LinkedField",
        "name": "evaluator",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "evaluationTarget",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "filterCondition",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "samplingRate",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "enabled",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectDecisionEvaluatorDialogContentUpdateMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectDecisionEvaluatorDialogContentUpdateMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "13d5392b3dd5d3ddc205a43b83b164c2",
    "id": null,
    "metadata": {},
    "name": "ProjectDecisionEvaluatorDialogContentUpdateMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectDecisionEvaluatorDialogContentUpdateMutation(\n  $input: UpdateProjectDecisionEvaluatorInput!\n) {\n  updateProjectDecisionEvaluator(input: $input) {\n    evaluator {\n      id\n      name\n      evaluationTarget\n      filterCondition\n      samplingRate\n      enabled\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "032e89564ffe21e4becf32dedd66076f";

export default node;
