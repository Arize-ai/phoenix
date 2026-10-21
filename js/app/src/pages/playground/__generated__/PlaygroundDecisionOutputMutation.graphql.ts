/**
 * @generated SignedSource<<d0a475a56997dafef6e4171182ef1593>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionTemplateFormat = "F_STRING" | "MUSTACHE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type RunDecisionInput = {
  connection: DecisionConnectionInput;
  inputValues: any;
  inputs: ReadonlyArray<DecisionInputDefinitionInput>;
  modelName: string;
  questions: ReadonlyArray<DecisionQuestionInput>;
  state: DecisionStateInput;
};
export type DecisionConnectionInput = {
  builtIn: BuiltInDecisionConnectionInput;
  customProvider?: never;
} | {
  builtIn?: never;
  customProvider: CustomProviderDecisionConnectionInput;
};
export type BuiltInDecisionConnectionInput = {
  baseUrl?: string | null;
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  providerKey: GenerativeProviderKey;
};
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type CustomProviderDecisionConnectionInput = {
  id: string;
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
export type PlaygroundDecisionOutputMutation$variables = {
  input: RunDecisionInput;
};
export type PlaygroundDecisionOutputMutation$data = {
  readonly runDecision: {
    readonly error: string | null;
    readonly result: {
      readonly answers: ReadonlyArray<{
        readonly __typename: string;
        readonly choice?: string;
        readonly choiceProbabilities?: ReadonlyArray<{
          readonly probability: number;
          readonly value: string;
        }>;
        readonly confidence?: number;
        readonly expectedLevel?: number;
        readonly levelProbabilities?: ReadonlyArray<{
          readonly level: number;
          readonly probability: number;
        }>;
        readonly name: string;
        readonly probability?: number;
      }>;
      readonly model: string;
      readonly usage: {
        readonly inputTokens: number | null;
        readonly outputTokens: number | null;
      };
    } | null;
    readonly span: {
      readonly id: string;
      readonly trace: {
        readonly traceId: string;
      };
    } | null;
  };
};
export type PlaygroundDecisionOutputMutation = {
  response: PlaygroundDecisionOutputMutation$data;
  variables: PlaygroundDecisionOutputMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionResult",
  "kind": "LinkedField",
  "name": "result",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "model",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "answers",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "__typename",
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
          "kind": "InlineFragment",
          "selections": [
            (v2/*:: as any*/)
          ],
          "type": "PredicateAnswer",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "choice",
              "storageKey": null
            },
            (v3/*:: as any*/),
            {
              "alias": "choiceProbabilities",
              "args": null,
              "concreteType": "ChoiceProbability",
              "kind": "LinkedField",
              "name": "probabilities",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "value",
                  "storageKey": null
                },
                (v2/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "ChoiceAnswer",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "expectedLevel",
              "storageKey": null
            },
            (v3/*:: as any*/),
            {
              "alias": "levelProbabilities",
              "args": null,
              "concreteType": "LevelProbability",
              "kind": "LinkedField",
              "name": "probabilities",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "level",
                  "storageKey": null
                },
                (v2/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "ScaleAnswer",
          "abstractKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionUsage",
      "kind": "LinkedField",
      "name": "usage",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "inputTokens",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "outputTokens",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDecisionOutputMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "RunDecisionPayload",
        "kind": "LinkedField",
        "name": "runDecision",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Span",
            "kind": "LinkedField",
            "name": "span",
            "plural": false,
            "selections": [
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PlaygroundDecisionOutputMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "RunDecisionPayload",
        "kind": "LinkedField",
        "name": "runDecision",
        "plural": false,
        "selections": [
          (v4/*:: as any*/),
          (v5/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Span",
            "kind": "LinkedField",
            "name": "span",
            "plural": false,
            "selections": [
              (v6/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Trace",
                "kind": "LinkedField",
                "name": "trace",
                "plural": false,
                "selections": [
                  (v7/*:: as any*/),
                  (v6/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "43696fde7bc3b35428d76c71879ca936",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDecisionOutputMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundDecisionOutputMutation(\n  $input: RunDecisionInput!\n) {\n  runDecision(input: $input) {\n    result {\n      model\n      answers {\n        __typename\n        name\n        ... on PredicateAnswer {\n          probability\n        }\n        ... on ChoiceAnswer {\n          choice\n          confidence\n          choiceProbabilities: probabilities {\n            value\n            probability\n          }\n        }\n        ... on ScaleAnswer {\n          expectedLevel\n          confidence\n          levelProbabilities: probabilities {\n            level\n            probability\n          }\n        }\n      }\n      usage {\n        inputTokens\n        outputTokens\n      }\n    }\n    error\n    span {\n      id\n      trace {\n        traceId\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1299f7e65b983bde0a5b137374fd26b7";

export default node;
