/**
 * @generated SignedSource<<f1f371ccc04575abd36e6aec7cc732ae>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionTemplateFormat = "F_STRING" | "MUSTACHE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type fetchPlaygroundDecisionQuery$variables = {
  decisionId: string;
  tagName?: string | null;
  versionId?: string | null;
};
export type fetchPlaygroundDecisionQuery$data = {
  readonly decision: {
    readonly id?: string;
    readonly name?: string;
    readonly version?: {
      readonly customProvider: {
        readonly id: string;
        readonly name: string;
      } | null;
      readonly id: string;
      readonly inputs: ReadonlyArray<{
        readonly name: string;
      }>;
      readonly modelName: string;
      readonly modelProvider: GenerativeProviderKey;
      readonly questions: ReadonlyArray<{
        readonly __typename: "DecisionChoiceQuestion";
        readonly choices: ReadonlyArray<{
          readonly description: string | null;
          readonly value: string;
        }>;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionPredicateQuestion";
        readonly criteria: {
          readonly false: string | null;
          readonly true: string | null;
        } | null;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionScaleQuestion";
        readonly instructions: string;
        readonly levels: ReadonlyArray<{
          readonly description: string | null;
          readonly label: string;
        }>;
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly state: {
        readonly __typename: "DecisionInputState";
        readonly input: string;
      } | {
        readonly __typename: "DecisionObjectState";
        readonly object: boolean;
      } | {
        readonly __typename: "DecisionTextState";
        readonly template: string;
        readonly templateFormat: DecisionTemplateFormat;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
    } | null;
  };
};
export type fetchPlaygroundDecisionQuery = {
  response: fetchPlaygroundDecisionQuery$data;
  variables: fetchPlaygroundDecisionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "decisionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tagName"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "versionId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "decisionId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "tagName",
      "variableName": "tagName"
    },
    {
      "kind": "Variable",
      "name": "versionId",
      "variableName": "versionId"
    }
  ],
  "concreteType": "DecisionVersion",
  "kind": "LinkedField",
  "name": "version",
  "plural": false,
  "selections": [
    (v4/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "modelProvider",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "modelName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "GenerativeModelCustomProvider",
      "kind": "LinkedField",
      "name": "customProvider",
      "plural": false,
      "selections": [
        (v4/*:: as any*/),
        (v5/*:: as any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionInputDefinition",
      "kind": "LinkedField",
      "name": "inputs",
      "plural": true,
      "selections": [
        (v5/*:: as any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "state",
      "plural": false,
      "selections": [
        (v6/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "object",
              "storageKey": null
            }
          ],
          "type": "DecisionObjectState",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "input",
              "storageKey": null
            }
          ],
          "type": "DecisionInputState",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "template",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "templateFormat",
              "storageKey": null
            }
          ],
          "type": "DecisionTextState",
          "abstractKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "questions",
      "plural": true,
      "selections": [
        (v6/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v5/*:: as any*/),
            (v7/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionPredicateCriteria",
              "kind": "LinkedField",
              "name": "criteria",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "true",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "false",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionPredicateQuestion",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v5/*:: as any*/),
            (v7/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionChoiceOption",
              "kind": "LinkedField",
              "name": "choices",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "value",
                  "storageKey": null
                },
                (v8/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionChoiceQuestion",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v5/*:: as any*/),
            (v7/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionScaleLevel",
              "kind": "LinkedField",
              "name": "levels",
              "plural": true,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "label",
                  "storageKey": null
                },
                (v8/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionScaleQuestion",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "fetchPlaygroundDecisionQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v9/*:: as any*/)
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v2/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "fetchPlaygroundDecisionQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*:: as any*/),
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              (v9/*:: as any*/)
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "aea019a28f3419d4c4d0e7fedb1b9803",
    "id": null,
    "metadata": {},
    "name": "fetchPlaygroundDecisionQuery",
    "operationKind": "query",
    "text": "query fetchPlaygroundDecisionQuery(\n  $decisionId: ID!\n  $versionId: ID\n  $tagName: Identifier\n) {\n  decision: node(id: $decisionId) {\n    __typename\n    ... on Decision {\n      id\n      name\n      version(versionId: $versionId, tagName: $tagName) {\n        id\n        modelProvider\n        modelName\n        customProvider {\n          id\n          name\n        }\n        inputs {\n          name\n        }\n        state {\n          __typename\n          ... on DecisionObjectState {\n            object\n          }\n          ... on DecisionInputState {\n            input\n          }\n          ... on DecisionTextState {\n            template\n            templateFormat\n          }\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n            instructions\n            criteria {\n              true\n              false\n            }\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            instructions\n            choices {\n              value\n              description\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            instructions\n            levels {\n              label\n              description\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "64b12a47609029c0b8cd9536697fcf28";

export default node;
