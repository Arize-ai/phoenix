/**
 * @generated SignedSource<<4e1ed0d3032fa770d2cab31fec4b3b49>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "CODE" | "LLM";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type EvaluatorConfigDialog_evaluatorQuery$variables = {
  evaluatorId: string;
};
export type EvaluatorConfigDialog_evaluatorQuery$data = {
  readonly evaluator: {
    readonly id: string;
    readonly inputSchema?: any | null;
    readonly isBuiltin?: boolean;
    readonly kind?: EvaluatorKind;
    readonly name?: string;
    readonly prompt?: {
      readonly id: string;
      readonly name: string;
    };
    readonly promptVersion?: {
      readonly id: string;
      readonly templateFormat: PromptTemplateFormat;
      readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessagesCard__main" | "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
    };
    readonly " $fragmentSpreads": FragmentRefs<"EvaluatorCodeConfig_evaluator" | "EvaluatorLLMConfig_evaluator">;
  };
};
export type EvaluatorConfigDialog_evaluatorQuery = {
  response: EvaluatorConfigDialog_evaluatorQuery$data;
  variables: EvaluatorConfigDialog_evaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "evaluatorId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "kind",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "isBuiltin",
      "storageKey": null
    }
  ],
  "type": "Evaluator",
  "abstractKey": "__isEvaluator"
},
v5 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "inputSchema",
    "storageKey": null
  }
],
v6 = {
  "kind": "InlineFragment",
  "selections": (v5/*: any*/),
  "type": "BuiltInEvaluator",
  "abstractKey": null
},
v7 = {
  "kind": "InlineFragment",
  "selections": (v5/*: any*/),
  "type": "CodeEvaluator",
  "abstractKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": [
    (v2/*: any*/),
    (v3/*: any*/)
  ],
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "invocationParameters",
  "storageKey": null
},
v13 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "ResponseFormat",
  "kind": "LinkedField",
  "name": "responseFormat",
  "plural": false,
  "selections": (v13/*: any*/),
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "template",
  "plural": false,
  "selections": [
    (v15/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptMessage",
          "kind": "LinkedField",
          "name": "messages",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "role",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "content",
              "plural": true,
              "selections": [
                (v15/*: any*/),
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "TextContentValue",
                      "kind": "LinkedField",
                      "name": "text",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "text",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "type": "TextContentPart",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ToolCallContentValue",
                      "kind": "LinkedField",
                      "name": "toolCall",
                      "plural": false,
                      "selections": [
                        (v16/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ToolCallFunction",
                          "kind": "LinkedField",
                          "name": "toolCall",
                          "plural": false,
                          "selections": [
                            (v3/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "arguments",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "type": "ToolCallContentPart",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ToolResultContentValue",
                      "kind": "LinkedField",
                      "name": "toolResult",
                      "plural": false,
                      "selections": [
                        (v16/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "result",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "type": "ToolResultContentPart",
                  "abstractKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "type": "PromptChatTemplate",
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
        }
      ],
      "type": "PromptStringTemplate",
      "abstractKey": null
    }
  ],
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "concreteType": "ToolDefinition",
  "kind": "LinkedField",
  "name": "tools",
  "plural": true,
  "selections": (v13/*: any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorConfigDialog_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v4/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "promptVersion",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v9/*: any*/),
                  {
                    "kind": "InlineDataFragmentSpread",
                    "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
                    "selections": [
                      (v2/*: any*/),
                      (v10/*: any*/),
                      (v11/*: any*/),
                      (v12/*: any*/),
                      (v14/*: any*/),
                      (v17/*: any*/),
                      (v18/*: any*/)
                    ],
                    "args": null,
                    "argumentDefinitions": []
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "PromptChatMessagesCard__main"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "LLMEvaluator",
            "abstractKey": null
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "EvaluatorLLMConfig_evaluator"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "EvaluatorCodeConfig_evaluator"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "EvaluatorConfigDialog_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v15/*: any*/),
          (v2/*: any*/),
          (v4/*: any*/),
          (v6/*: any*/),
          (v7/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersion",
                "kind": "LinkedField",
                "name": "promptVersion",
                "plural": false,
                "selections": [
                  (v2/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
                  (v12/*: any*/),
                  (v14/*: any*/),
                  (v17/*: any*/),
                  (v18/*: any*/),
                  {
                    "alias": "provider",
                    "args": null,
                    "kind": "ScalarField",
                    "name": "modelProvider",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "templateType",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "CategoricalAnnotationConfig",
                "kind": "LinkedField",
                "name": "outputConfig",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "CategoricalAnnotationValue",
                    "kind": "LinkedField",
                    "name": "values",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "label",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "score",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  (v2/*: any*/),
                  (v3/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "LLMEvaluator",
            "abstractKey": null
          },
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "2e6088aef68d8426f2a4114f83444ab3",
    "id": null,
    "metadata": {},
    "name": "EvaluatorConfigDialog_evaluatorQuery",
    "operationKind": "query",
    "text": "query EvaluatorConfigDialog_evaluatorQuery(\n  $evaluatorId: ID!\n) {\n  evaluator: node(id: $evaluatorId) {\n    __typename\n    id\n    ... on Evaluator {\n      __isEvaluator: __typename\n      name\n      kind\n      isBuiltin\n    }\n    ... on BuiltInEvaluator {\n      inputSchema\n    }\n    ... on CodeEvaluator {\n      inputSchema\n    }\n    ... on LLMEvaluator {\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        id\n        templateFormat\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        ...PromptChatMessagesCard__main\n      }\n    }\n    ...EvaluatorLLMConfig_evaluator\n    ...EvaluatorCodeConfig_evaluator\n  }\n}\n\nfragment ContainsEvaluatorForm_query on Node {\n  __isNode: __typename\n  id\n  ... on Evaluator {\n    __isEvaluator: __typename\n    name\n    kind\n    isBuiltin\n  }\n  ... on BuiltInEvaluator {\n    inputSchema\n  }\n}\n\nfragment EvaluatorCodeConfig_CodeEvaluatorForm on Node {\n  __isNode: __typename\n  ... on Evaluator {\n    __isEvaluator: __typename\n    name\n    isBuiltin\n  }\n  ...ContainsEvaluatorForm_query\n}\n\nfragment EvaluatorCodeConfig_evaluator on Node {\n  __isNode: __typename\n  id\n  ... on Evaluator {\n    __isEvaluator: __typename\n    name\n    kind\n    isBuiltin\n  }\n  ... on CodeEvaluator {\n    inputSchema\n  }\n  ... on BuiltInEvaluator {\n    inputSchema\n  }\n  ...EvaluatorCodeConfig_CodeEvaluatorForm\n}\n\nfragment EvaluatorLLMConfig_evaluator on Node {\n  __isNode: __typename\n  id\n  ... on Evaluator {\n    __isEvaluator: __typename\n    name\n    kind\n  }\n  ... on LLMEvaluator {\n    ...EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig\n    outputConfig {\n      name\n      values {\n        label\n        score\n      }\n      id\n    }\n    prompt {\n      id\n      name\n    }\n    promptVersion {\n      id\n      templateFormat\n      ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n      ...PromptChatMessagesCard__main\n    }\n  }\n}\n\nfragment EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig on LLMEvaluator {\n  outputConfig {\n    values {\n      label\n      score\n    }\n    id\n  }\n}\n\nfragment PromptChatMessagesCard__main on PromptVersion {\n  provider: modelProvider\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                arguments\n                name\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  templateType\n  templateFormat\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters\n  responseFormat {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    definition\n  }\n}\n"
  }
};
})();

(node as any).hash = "956d20c99417a2e98d31657508e4b7de";

export default node;
