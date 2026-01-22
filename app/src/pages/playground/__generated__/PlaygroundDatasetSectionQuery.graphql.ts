/**
 * @generated SignedSource<<b3c11556695b99aea3fdb873a1ff2749>>
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
  };
  readonly " $fragmentSpreads": FragmentRefs<"PlaygroundEvaluatorSelect_query">;
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
  "kind": "ScalarField",
  "name": "isBuiltin",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v7/*: any*/),
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
    }
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v9 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v7/*: any*/),
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
                              (v2/*: any*/),
                              (v3/*: any*/),
                              (v4/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "evaluator",
                                "plural": false,
                                "selections": [
                                  (v2/*: any*/),
                                  (v5/*: any*/),
                                  (v6/*: any*/)
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
                                  (v8/*: any*/),
                                  (v9/*: any*/)
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
        "name": "PlaygroundEvaluatorSelect_query"
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
                          (v2/*: any*/),
                          (v3/*: any*/),
                          (v4/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "evaluator",
                            "plural": false,
                            "selections": [
                              (v10/*: any*/),
                              (v2/*: any*/),
                              (v5/*: any*/),
                              (v6/*: any*/)
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
                              (v10/*: any*/),
                              (v8/*: any*/),
                              (v9/*: any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v2/*: any*/)
                                ],
                                "type": "Node",
                                "abstractKey": "__isNode"
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
          (v2/*: any*/)
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
          (v2/*: any*/),
          (v3/*: any*/),
          (v5/*: any*/)
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
          (v3/*: any*/),
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
          (v7/*: any*/),
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
    "cacheID": "eaba3e3df1a4ff2264a5ad2180806f95",
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
    "text": "query PlaygroundDatasetSectionQuery(\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      datasetEvaluators(first: 100) {\n        edges {\n          node {\n            ...PlaygroundDatasetSection_evaluator\n            id\n            __typename\n          }\n          cursor\n        }\n        pageInfo {\n          endCursor\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n  ...PlaygroundEvaluatorSelect_query\n}\n\nfragment AddEvaluatorMenu_codeEvaluatorTemplates on Query {\n  builtInEvaluators {\n    id\n    name\n    kind\n  }\n}\n\nfragment AddEvaluatorMenu_llmEvaluatorTemplates on Query {\n  classificationEvaluatorConfigs {\n    name\n    description\n    choices\n    optimizationDirection\n    messages {\n      ...promptUtils_promptMessages\n    }\n  }\n}\n\nfragment PlaygroundDatasetSection_evaluator on DatasetEvaluator {\n  id\n  name\n  inputMapping {\n    literalMapping\n    pathMapping\n  }\n  evaluator {\n    __typename\n    id\n    kind\n    isBuiltin\n  }\n  outputConfig {\n    __typename\n    ... on CategoricalAnnotationConfig {\n      name\n      optimizationDirection\n      values {\n        label\n        score\n      }\n    }\n    ... on ContinuousAnnotationConfig {\n      name\n      optimizationDirection\n      lowerBound\n      upperBound\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n\nfragment PlaygroundEvaluatorSelect_query on Query {\n  ...AddEvaluatorMenu_codeEvaluatorTemplates\n  ...AddEvaluatorMenu_llmEvaluatorTemplates\n}\n\nfragment promptUtils_promptMessages on PromptMessage {\n  content {\n    __typename\n    ... on TextContentPart {\n      text {\n        text\n      }\n    }\n  }\n  role\n}\n"
  }
};
})();

(node as any).hash = "a77a52b98ebc60395e2e1a0b2bca4c6c";

export default node;
