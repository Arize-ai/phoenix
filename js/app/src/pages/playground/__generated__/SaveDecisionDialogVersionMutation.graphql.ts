/**
 * @generated SignedSource<<30cd9eb84a274f038a0b85948824de45>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionTemplateFormat = "F_STRING" | "MUSTACHE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type CreateDecisionVersionInput = {
  decisionId: string;
  tags?: ReadonlyArray<CreateDecisionVersionTagInput> | null;
  version: DecisionVersionInput;
};
export type DecisionVersionInput = {
  customProviderId?: string | null;
  description?: string | null;
  inputs: ReadonlyArray<DecisionInputDefinitionInput>;
  metadata?: any | null;
  modelName: string;
  modelProvider: GenerativeProviderKey;
  questions: ReadonlyArray<DecisionQuestionInput>;
  state: DecisionStateInput;
};
export type DecisionInputDefinitionInput = {
  description?: string | null;
  jsonSchema?: any | null;
  name: string;
};
export type DecisionStateInput = {
  input?: never;
  object: boolean;
  text?: never;
} | {
  input?: never;
  object?: never;
  text: TextStateInput;
} | {
  input: string;
  object?: never;
  text?: never;
};
export type TextStateInput = {
  template: string;
  templateFormat: DecisionTemplateFormat;
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
export type SaveDecisionDialogVersionMutation$variables = {
  input: CreateDecisionVersionInput;
};
export type SaveDecisionDialogVersionMutation$data = {
  readonly createDecisionVersion: {
    readonly id: string;
    readonly name: string;
    readonly version: {
      readonly id: string;
    } | null;
  };
};
export type SaveDecisionDialogVersionMutation = {
  response: SaveDecisionDialogVersionMutation$data;
  variables: SaveDecisionDialogVersionMutation$variables;
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
    "name": "createDecisionVersion",
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
    "name": "SaveDecisionDialogVersionMutation",
    "selections": (v2/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SaveDecisionDialogVersionMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "c1dd46fa111d01d172892a96b7fa5369",
    "id": null,
    "metadata": {},
    "name": "SaveDecisionDialogVersionMutation",
    "operationKind": "mutation",
    "text": "mutation SaveDecisionDialogVersionMutation(\n  $input: CreateDecisionVersionInput!\n) {\n  createDecisionVersion(input: $input) {\n    id\n    name\n    version {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fc13bed0601a27b63552d22063798fbb";

export default node;
