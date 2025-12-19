/**
 * @generated SignedSource<<a14dee6b86d527a063e064f6984b3e2a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "CODE" | "LLM";
export type datasetEvaluatorDetailsLoaderQuery$variables = {
  datasetEvaluatorId: string;
  datasetId: string;
};
export type datasetEvaluatorDetailsLoaderQuery$data = {
  readonly dataset: {
    readonly datasetEvaluator?: {
      readonly displayName: string;
      readonly evaluator: {
        readonly __typename: string;
        readonly description: string | null;
        readonly isBuiltin: boolean;
        readonly kind: EvaluatorKind;
        readonly " $fragmentSpreads": FragmentRefs<"BuiltInDatasetEvaluatorDetails_evaluator" | "LLMDatasetEvaluatorDetails_evaluator">;
      };
      readonly id: string;
    };
    readonly id: string;
  };
};
export type datasetEvaluatorDetailsLoaderQuery = {
  response: datasetEvaluatorDetailsLoaderQuery$data;
  variables: datasetEvaluatorDetailsLoaderQuery$variables;
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "datasetEvaluatorId",
    "variableName": "datasetEvaluatorId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "displayName",
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
  "name": "kind",
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
  "args": null,
  "kind": "ScalarField",
  "name": "isBuiltin",
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
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
                  (v5/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v6/*: any*/),
                      (v7/*: any*/),
                      (v8/*: any*/),
                      (v9/*: any*/),
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "args": null,
                            "kind": "FragmentSpread",
                            "name": "LLMDatasetEvaluatorDetails_evaluator"
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "args": null,
                            "kind": "FragmentSpread",
                            "name": "BuiltInDatasetEvaluatorDetails_evaluator"
                          }
                        ],
                        "type": "BuiltInEvaluator",
                        "abstractKey": null
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
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v4/*: any*/),
                "concreteType": "DatasetEvaluator",
                "kind": "LinkedField",
                "name": "datasetEvaluator",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
                  (v5/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": null,
                    "kind": "LinkedField",
                    "name": "evaluator",
                    "plural": false,
                    "selections": [
                      (v6/*: any*/),
                      (v7/*: any*/),
                      (v8/*: any*/),
                      (v9/*: any*/),
                      (v3/*: any*/),
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
                              (v3/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "name",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          }
                        ],
                        "type": "LLMEvaluator",
                        "abstractKey": null
                      },
                      {
                        "kind": "InlineFragment",
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "inputSchema",
                            "storageKey": null
                          }
                        ],
                        "type": "BuiltInEvaluator",
                        "abstractKey": null
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "331a1c0acdd2f66946138e5308ca19d8",
    "id": null,
    "metadata": {},
    "name": "datasetEvaluatorDetailsLoaderQuery",
    "operationKind": "query",
    "text": "query datasetEvaluatorDetailsLoaderQuery(\n  $datasetId: ID!\n  $datasetEvaluatorId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    id\n    ... on Dataset {\n      id\n      datasetEvaluator(datasetEvaluatorId: $datasetEvaluatorId) {\n        id\n        displayName\n        evaluator {\n          __typename\n          kind\n          description\n          isBuiltin\n          ... on LLMEvaluator {\n            ...LLMDatasetEvaluatorDetails_evaluator\n          }\n          ... on BuiltInEvaluator {\n            ...BuiltInDatasetEvaluatorDetails_evaluator\n          }\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment BuiltInDatasetEvaluatorDetails_evaluator on BuiltInEvaluator {\n  kind\n  metadata\n  inputSchema\n}\n\nfragment LLMDatasetEvaluatorDetails_evaluator on LLMEvaluator {\n  kind\n  prompt {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "bb95ec53d8c6d96d1d67fe57e3db64c4";

export default node;
