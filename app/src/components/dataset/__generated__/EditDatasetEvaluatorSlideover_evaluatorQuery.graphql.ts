/**
 * @generated SignedSource<<30dbb547ff80a8213fb2e4df6eb2d90c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EditDatasetEvaluatorSlideover_evaluatorQuery$variables = {
  datasetId: string;
  evaluatorId: string;
};
export type EditDatasetEvaluatorSlideover_evaluatorQuery$data = {
  readonly evaluator: {
    readonly " $fragmentSpreads": FragmentRefs<"EditDatasetEvaluatorSlideover_evaluator">;
  };
};
export type EditDatasetEvaluatorSlideover_evaluatorQuery = {
  response: EditDatasetEvaluatorSlideover_evaluatorQuery$data;
  variables: EditDatasetEvaluatorSlideover_evaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "evaluatorId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorId"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "datasetId",
    "variableName": "datasetId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
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
  "name": "toolCallId",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": (v3/*: any*/),
                "kind": "FragmentSpread",
                "name": "EditDatasetEvaluatorSlideover_evaluator"
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
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "EditDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "evaluator",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v5/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v6/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "description",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "kind",
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v3/*: any*/),
                "kind": "ScalarField",
                "name": "isAssignedToDataset",
                "storageKey": null
              },
              {
                "kind": "InlineFragment",
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Prompt",
                    "kind": "LinkedField",
                    "name": "prompt",
                    "plural": false,
                    "selections": [
                      (v5/*: any*/),
                      (v6/*: any*/)
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersion",
                    "kind": "LinkedField",
                    "name": "promptVersion",
                    "plural": false,
                    "selections": [
                      (v5/*: any*/),
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
                          (v4/*: any*/),
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
                                      (v4/*: any*/),
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
                                              (v8/*: any*/),
                                              {
                                                "alias": null,
                                                "args": null,
                                                "concreteType": "ToolCallFunction",
                                                "kind": "LinkedField",
                                                "name": "toolCall",
                                                "plural": false,
                                                "selections": [
                                                  (v6/*: any*/),
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
                                              (v8/*: any*/),
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
                      (v6/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "optimizationDirection",
                        "storageKey": null
                      },
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
                      (v5/*: any*/)
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
    "cacheID": "3cd66fe2ad86dc30e84c0e27915b953d",
    "id": null,
    "metadata": {},
    "name": "EditDatasetEvaluatorSlideover_evaluatorQuery",
    "operationKind": "query",
    "text": "query EditDatasetEvaluatorSlideover_evaluatorQuery(\n  $evaluatorId: ID!\n  $datasetId: ID!\n) {\n  evaluator: node(id: $evaluatorId) {\n    __typename\n    ... on Evaluator {\n      __isEvaluator: __typename\n      ...EditDatasetEvaluatorSlideover_evaluator_1wYocp\n    }\n    id\n  }\n}\n\nfragment EditDatasetEvaluatorSlideover_evaluator_1wYocp on Evaluator {\n  __isEvaluator: __typename\n  id\n  name\n  description\n  kind\n  isAssignedToDataset(datasetId: $datasetId)\n  ... on LLMEvaluator {\n    prompt {\n      id\n      name\n    }\n    promptVersion {\n      ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n      id\n    }\n    outputConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n      id\n    }\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters\n  responseFormat {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    definition\n  }\n}\n"
  }
};
})();

(node as any).hash = "3e90efee1f0840db87a78f42aa7b912f";

export default node;
