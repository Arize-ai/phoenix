/**
 * @generated SignedSource<<666008be855137c9dc163cbf1fb6c7fd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "CODE" | "LLM";
export type EditEvaluatorSlideover_evaluatorQuery$variables = {
  evaluatorId: string;
};
export type EditEvaluatorSlideover_evaluatorQuery$data = {
  readonly evaluator: {
    readonly description?: string | null;
    readonly id?: string;
    readonly kind?: EvaluatorKind;
    readonly name?: string;
    readonly outputConfig?: {
      readonly name: string;
      readonly values: ReadonlyArray<{
        readonly label: string;
        readonly score: number | null;
      }>;
    };
    readonly prompt?: {
      readonly id: string;
      readonly name: string;
    };
    readonly promptVersion?: {
      readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
    };
  };
};
export type EditEvaluatorSlideover_evaluatorQuery = {
  response: EditEvaluatorSlideover_evaluatorQuery$data;
  variables: EditEvaluatorSlideover_evaluatorQuery$variables;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v6 = {
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
v7 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "definition",
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "toolCallId",
  "storageKey": null
},
v10 = [
  (v2/*: any*/),
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
    "kind": "ScalarField",
    "name": "modelProvider",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "invocationParameters",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "ResponseFormat",
    "kind": "LinkedField",
    "name": "responseFormat",
    "plural": false,
    "selections": (v7/*: any*/),
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": null,
    "kind": "LinkedField",
    "name": "template",
    "plural": false,
    "selections": [
      (v8/*: any*/),
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
                  (v8/*: any*/),
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
                          (v9/*: any*/),
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
                          (v9/*: any*/),
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
  {
    "alias": null,
    "args": null,
    "concreteType": "ToolDefinition",
    "kind": "LinkedField",
    "name": "tools",
    "plural": true,
    "selections": (v7/*: any*/),
    "storageKey": null
  }
],
v11 = {
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v6/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersion",
                    "kind": "LinkedField",
                    "name": "promptVersion",
                    "plural": false,
                    "selections": [
                      {
                        "kind": "InlineDataFragmentSpread",
                        "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
                        "selections": (v10/*: any*/),
                        "args": null,
                        "argumentDefinitions": []
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
                      (v3/*: any*/),
                      (v11/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "type": "LLMEvaluator",
                "abstractKey": null
              }
            ],
            "type": "Evaluator",
            "abstractKey": "__isEvaluator"
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
    "name": "EditEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v8/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v6/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersion",
                    "kind": "LinkedField",
                    "name": "promptVersion",
                    "plural": false,
                    "selections": (v10/*: any*/),
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
                      (v3/*: any*/),
                      (v11/*: any*/),
                      (v2/*: any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "type": "LLMEvaluator",
                "abstractKey": null
              }
            ],
            "type": "Evaluator",
            "abstractKey": "__isEvaluator"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "14a8fbaa52155fe06ec20fdb143162dc",
    "id": null,
    "metadata": {},
    "name": "EditEvaluatorSlideover_evaluatorQuery",
    "operationKind": "query",
    "text": "query EditEvaluatorSlideover_evaluatorQuery(\n  $evaluatorId: ID!\n) {\n  evaluator: node(id: $evaluatorId) {\n    __typename\n    ... on Evaluator {\n      __isEvaluator: __typename\n      id\n      name\n      description\n      kind\n      ... on LLMEvaluator {\n        prompt {\n          id\n          name\n        }\n        promptVersion {\n          ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n          id\n        }\n        outputConfig {\n          name\n          values {\n            label\n            score\n          }\n          id\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters\n  responseFormat {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    definition\n  }\n}\n"
  }
};
})();

(node as any).hash = "33767e43ede92b54b769e5da9b2dcf38";

export default node;
