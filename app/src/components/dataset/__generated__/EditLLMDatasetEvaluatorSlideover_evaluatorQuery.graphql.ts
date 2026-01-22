/**
 * @generated SignedSource<<e8e773b0172064d3814647b9c4df43c9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
export type EditLLMDatasetEvaluatorSlideover_evaluatorQuery$variables = {
  datasetEvaluatorId: string;
  datasetId: string;
};
export type EditLLMDatasetEvaluatorSlideover_evaluatorQuery$data = {
  readonly dataset: {
    readonly datasetEvaluator?: {
      readonly evaluator: {
        readonly prompt?: {
          readonly id: string;
          readonly name: string;
        };
        readonly promptVersion?: {
          readonly templateFormat: PromptTemplateFormat;
          readonly " $fragmentSpreads": FragmentRefs<"fetchPlaygroundPrompt_promptVersionToInstance_promptVersion">;
        };
        readonly promptVersionTag?: {
          readonly name: string;
        } | null;
      };
      readonly " $fragmentSpreads": FragmentRefs<"EditLLMDatasetEvaluatorSlideover_evaluator">;
    };
  };
};
export type EditLLMDatasetEvaluatorSlideover_evaluatorQuery = {
  response: EditLLMDatasetEvaluatorSlideover_evaluatorQuery$data;
  variables: EditLLMDatasetEvaluatorSlideover_evaluatorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetEvaluatorId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "datasetEvaluatorId",
    "variableName": "datasetEvaluatorId"
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
v6 = [
  (v4/*: any*/),
  (v5/*: any*/)
],
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "Prompt",
  "kind": "LinkedField",
  "name": "prompt",
  "plural": false,
  "selections": (v6/*: any*/),
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "templateFormat",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "invocationParameters",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "GenerativeModelCustomProvider",
  "kind": "LinkedField",
  "name": "customProvider",
  "plural": false,
  "selections": (v6/*: any*/),
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
                            (v5/*: any*/),
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
},
v19 = [
  (v5/*: any*/)
],
v20 = {
  "kind": "InlineFragment",
  "selections": (v19/*: any*/),
  "type": "AnnotationConfigBase",
  "abstractKey": "__isAnnotationConfigBase"
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v22 = {
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditLLMDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
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
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v7/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": [
                              (v8/*: any*/),
                              {
                                "kind": "InlineDataFragmentSpread",
                                "name": "fetchPlaygroundPrompt_promptVersionToInstance_promptVersion",
                                "selections": [
                                  (v4/*: any*/),
                                  (v9/*: any*/),
                                  (v10/*: any*/),
                                  (v11/*: any*/),
                                  (v12/*: any*/),
                                  (v14/*: any*/),
                                  (v17/*: any*/),
                                  (v18/*: any*/)
                                ],
                                "args": null,
                                "argumentDefinitions": []
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": (v19/*: any*/),
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "EditLLMDatasetEvaluatorSlideover_evaluator"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
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
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "EditLLMDatasetEvaluatorSlideover_evaluatorQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v15/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v15/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v7/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersion",
                            "kind": "LinkedField",
                            "name": "promptVersion",
                            "plural": false,
                            "selections": [
                              (v8/*: any*/),
                              (v4/*: any*/),
                              (v9/*: any*/),
                              (v10/*: any*/),
                              (v11/*: any*/),
                              (v12/*: any*/),
                              (v14/*: any*/),
                              (v17/*: any*/),
                              (v18/*: any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "PromptVersionTag",
                            "kind": "LinkedField",
                            "name": "promptVersionTag",
                            "plural": false,
                            "selections": [
                              (v5/*: any*/),
                              (v4/*: any*/)
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
                              (v20/*: any*/),
                              (v21/*: any*/),
                              (v22/*: any*/),
                              (v4/*: any*/)
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      },
                      (v4/*: any*/),
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
                      (v5/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v4/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "displayName",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorInputMapping",
                    "kind": "LinkedField",
                    "name": "inputMapping",
                    "plural": false,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "literalMapping",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "pathMapping",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "outputConfig",
                    "plural": false,
                    "selections": [
                      (v15/*: any*/),
                      (v20/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v21/*: any*/),
                          (v22/*: any*/)
                        ],
                        "type": "CategoricalAnnotationConfig",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v21/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "lowerBound",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "upperBound",
                            "storageKey": null
                          }
                        ],
                        "type": "ContinuousAnnotationConfig",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          (v4/*: any*/)
                        ],
                        "type": "Node",
                        "abstractKey": "__isNode"
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e381ac2386b64ccaceee66b02c2b6378",
    "id": null,
    "metadata": {},
    "name": "EditLLMDatasetEvaluatorSlideover_evaluatorQuery",
    "operationKind": "query",
    "text": "query EditLLMDatasetEvaluatorSlideover_evaluatorQuery(\n  $datasetId: ID!\n  $datasetEvaluatorId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        evaluator {\n          __typename\n          ... on LLMEvaluator {\n            prompt {\n              id\n              name\n            }\n            promptVersion {\n              templateFormat\n              ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n              id\n            }\n            promptVersionTag {\n              name\n              id\n            }\n          }\n          id\n        }\n        ...EditLLMDatasetEvaluatorSlideover_evaluator\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment EditLLMDatasetEvaluatorSlideover_evaluator on DatasetEvaluator {\n  id\n  displayName\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  outputConfig {\n    __typename\n    ... on AnnotationConfigBase {\n      __isAnnotationConfigBase: __typename\n      name\n    }\n    ... on CategoricalAnnotationConfig {\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  evaluator {\n    __typename\n    description\n    kind\n    name\n    ... on LLMEvaluator {\n      outputConfig {\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n        }\n        optimizationDirection\n        values {\n          label\n          score\n        }\n        id\n      }\n      prompt {\n        id\n        name\n      }\n      promptVersion {\n        tools {\n          definition\n        }\n        ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment fetchPlaygroundPrompt_promptVersionToInstance_promptVersion on PromptVersion {\n  id\n  modelName\n  modelProvider\n  invocationParameters\n  customProvider {\n    id\n    name\n  }\n  responseFormat {\n    definition\n  }\n  template {\n    __typename\n    ... on PromptChatTemplate {\n      messages {\n        role\n        content {\n          __typename\n          ... on TextContentPart {\n            text {\n              text\n            }\n          }\n          ... on ToolCallContentPart {\n            toolCall {\n              toolCallId\n              toolCall {\n                name\n                arguments\n              }\n            }\n          }\n          ... on ToolResultContentPart {\n            toolResult {\n              toolCallId\n              result\n            }\n          }\n        }\n      }\n    }\n    ... on PromptStringTemplate {\n      template\n    }\n  }\n  tools {\n    definition\n  }\n}\n"
  }
};
})();

(node as any).hash = "ff27ce93727168be7c8def9a781c7202";

export default node;
