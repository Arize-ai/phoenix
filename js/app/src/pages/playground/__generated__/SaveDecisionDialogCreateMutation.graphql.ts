/**
 * @generated SignedSource<<a0096f2b0754376ac20af5039857c785>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type CreateDecisionInput = {
  description?: string | null;
  metadata?: any | null;
  name: string;
  tags?: ReadonlyArray<CreateDecisionVersionTagInput> | null;
  version: DecisionVersionInput;
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
export type CreateDecisionVersionTagInput = {
  description?: string | null;
  name: string;
};
export type SaveDecisionDialogCreateMutation$variables = {
  input: CreateDecisionInput;
};
export type SaveDecisionDialogCreateMutation$data = {
  readonly createDecision: {
    readonly id: string;
    readonly name: string;
    readonly version: {
      readonly id: string;
    } | null;
  };
};
export type SaveDecisionDialogCreateMutation = {
  response: SaveDecisionDialogCreateMutation$data;
  variables: SaveDecisionDialogCreateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "Decision",
    "kind": "LinkedField",
    "name": "createDecision",
    "plural": false,
    "selections": [
      (v1/*:: as any*/),
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
        "concreteType": "DecisionVersion",
        "kind": "LinkedField",
        "name": "version",
        "plural": false,
        "selections": [
          (v1/*:: as any*/)
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
    "name": "SaveDecisionDialogCreateMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SaveDecisionDialogCreateMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "d511b7d9d653c43de075984f6bd7c3e4",
    "id": null,
    "metadata": {},
    "name": "SaveDecisionDialogCreateMutation",
    "operationKind": "mutation",
    "text": "mutation SaveDecisionDialogCreateMutation(\n  $input: CreateDecisionInput!\n) {\n  createDecision(input: $input) {\n    id\n    name\n    version {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "21dab9487a9d9ec9ec0c21c02356bd01";

export default node;
