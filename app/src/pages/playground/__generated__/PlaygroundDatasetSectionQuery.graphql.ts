/**
 * @generated SignedSource<<875b077e0eef1a5680c743ca5104545d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetSectionQuery$variables = {
  datasetId: string;
  splitIds?: ReadonlyArray<string> | null;
};
export type PlaygroundDatasetSectionQuery$data = {
  readonly dataset: {
    readonly datasetEvaluators?: {
      readonly __id: string;
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetSection_evaluator">;
        };
      }>;
    };
    readonly exampleCount?: number;
    readonly name?: string;
    readonly splits?: ReadonlyArray<{
      readonly color: string;
      readonly id: string;
      readonly name: string;
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_codeEvaluatorTemplates" | "AddEvaluatorMenu_llmEvaluatorTemplates">;
};
export type PlaygroundDatasetSectionQuery = {
  response: PlaygroundDatasetSectionQuery$data;
  variables: PlaygroundDatasetSectionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "splitIds"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "splitIds",
      "variableName": "splitIds"
    }
  ],
  "kind": "ScalarField",
  "name": "exampleCount",
  "storageKey": null
},
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
  "concreteType": "DatasetSplit",
  "kind": "LinkedField",
  "name": "splits",
  "plural": true,
  "selections": [
    (v4/*: any*/),
    (v2/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "color",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
  "storageKey": null
},
v7 = {
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
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBuiltin",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "PageInfo",
  "kind": "LinkedField",
  "name": "pageInfo",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endCursor",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasNextPage",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v13 = {
  "kind": "ClientExtension",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "__id",
      "storageKey": null
    }
  ]
},
v14 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundDatasetSectionQuery",
    "selections": [
      {
        "alias": "dataset",
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
              (v5/*: any*/),
              {
                "alias": "datasetEvaluators",
                "args": null,
                "concreteType": "DatasetEvaluatorConnection",
                "kind": "LinkedField",
                "name": "__PlaygroundDatasetSection_datasetEvaluators_connection",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          {
                            "kind": "InlineDataFragmentSpread",
                            "name": "PlaygroundDatasetSection_evaluator",
                            "selections": [
                              (v4/*: any*/),
                              (v6/*: any*/),
                              (v7/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "evaluator",
                                "plural": false,
                                "selections": [
                                  (v4/*: any*/),
                                  (v8/*: any*/),
                                  (v9/*: any*/),
                                  {
                                    "kind": "InlineFragment",
                                    "selections": [
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "CategoricalAnnotationConfig",
                                        "kind": "LinkedField",
                                        "name": "outputConfig",
                                        "plural": false,
                                        "selections": [
                                          (v2/*: any*/)
                                        ],
                                        "storageKey": null
                                      }
                                    ],
                                    "type": "LLMEvaluator",
                                    "abstractKey": null
                                  }
                                ],
                                "storageKey": null
                              }
                            ],
                            "args": null,
                            "argumentDefinitions": []
                          },
                          (v10/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v11/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v12/*: any*/),
                  (v13/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "AddEvaluatorMenu_codeEvaluatorTemplates"
      },
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "AddEvaluatorMenu_llmEvaluatorTemplates"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundDatasetSectionQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v10/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": (v14/*: any*/),
                "concreteType": "DatasetEvaluatorConnection",
                "kind": "LinkedField",
                "name": "datasetEvaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v4/*: any*/),
                          (v6/*: any*/),
                          (v7/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "evaluator",
                            "plural": false,
                            "selections": [
                              (v10/*: any*/),
                              (v4/*: any*/),
                              (v8/*: any*/),
                              (v9/*: any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "CategoricalAnnotationConfig",
                                    "kind": "LinkedField",
                                    "name": "outputConfig",
                                    "plural": false,
                                    "selections": [
                                      (v2/*: any*/),
                                      (v4/*: any*/)
                                    ],
                                    "storageKey": null
                                  }
                                ],
                                "type": "LLMEvaluator",
                                "abstractKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v10/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v11/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v12/*: any*/),
                  (v13/*: any*/)
                ],
                "storageKey": "datasetEvaluators(first:100)"
              },
              {
                "alias": null,
                "args": (v14/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "PlaygroundDatasetSection_datasetEvaluators",
                "kind": "LinkedHandle",
                "name": "datasetEvaluators"
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "BuiltInEvaluator",
        "kind": "LinkedField",
        "name": "builtInEvaluators",
        "plural": true,
        "selections": [
          (v4/*: any*/),
          (v2/*: any*/),
          (v8/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ClassificationEvaluatorConfig",
        "kind": "LinkedField",
        "name": "classificationEvaluatorConfigs",
        "plural": true,
        "selections": [
          (v2/*: any*/),
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
            "name": "choices",
            "storageKey": null
          },
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
            "concreteType": "PromptMessage",
            "kind": "LinkedField",
            "name": "messages",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "content",
                "plural": true,
                "selections": [
                  (v10/*: any*/),
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
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "role",
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
    "cacheID": "fd817ffb7f892226633d2ffc68bb2d96",
    "id": null,
    "metadata": {
      "connection": [
        {
          "count": null,
          "cursor": null,
          "direction": "forward",
          "path": [
            "dataset",
            "datasetEvaluators"
          ]
        }
      ]
    },
    "name": "PlaygroundDatasetSectionQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetSectionQuery(\n  $datasetId: ID!\n  $splitIds: [ID!]\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      name\n      exampleCount(splitIds: $splitIds)\n      splits {\n        id\n        name\n        color\n      }\n      datasetEvaluators(first: 100) {\n        edges {\n          node {\n            ...PlaygroundDatasetSection_evaluator\n            id\n            __typename\n          }\n          cursor\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n  ...AddEvaluatorMenu_codeEvaluatorTemplates\n  ...AddEvaluatorMenu_llmEvaluatorTemplates\n}\n\nfragment AddEvaluatorMenu_codeEvaluatorTemplates on Query {\n  builtInEvaluators {\n    id\n    name\n    kind\n  }\n}\n\nfragment AddEvaluatorMenu_llmEvaluatorTemplates on Query {\n  classificationEvaluatorConfigs {\n    name\n    description\n    choices\n    optimizationDirection\n    messages {\n      ...promptUtils_promptMessages\n    }\n  }\n}\n\nfragment PlaygroundDatasetSection_evaluator on DatasetEvaluator {\n  id\n  displayName\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    id\n    kind\n    isBuiltin\n    ... on LLMEvaluator {\n      outputConfig {\n        name\n        id\n      }\n    }\n  }\n}\n\nfragment promptUtils_promptMessages on PromptMessage {\n  content {\n    __typename\n    ... on TextContentPart {\n      text {\n        text\n      }\n    }\n  }\n  role\n}\n"
  }
};
})();

(node as any).hash = "6882523154acd6f8c7f94358e9fe47f9";

export default node;
