/**
 * @generated SignedSource<<4c8e6439ebb2d32e2b0922b1d4e9c0c1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EvaluatorKind = "CODE" | "LLM";
export type PlaygroundDatasetSectionQuery$variables = {
  datasetId: string;
};
export type PlaygroundDatasetSectionQuery$data = {
  readonly dataset: {
    readonly evaluators?: {
      readonly edges: ReadonlyArray<{
        readonly evaluator: {
          readonly id: string;
          readonly isAssignedToDataset: boolean;
          readonly kind: EvaluatorKind;
          readonly name: string;
          readonly outputConfig?: {
            readonly name: string;
          };
        };
      }>;
    };
    readonly " $fragmentSpreads": FragmentRefs<"EvaluatorConfigDialog_dataset">;
  };
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
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "datasetId",
      "variableName": "datasetId"
    }
  ],
  "kind": "ScalarField",
  "name": "isAssignedToDataset",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
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
                "alias": null,
                "args": null,
                "concreteType": "EvaluatorConnection",
                "kind": "LinkedField",
                "name": "evaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "evaluator",
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/),
                          (v3/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/),
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
                                  (v3/*: any*/)
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
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "EvaluatorConfigDialog_dataset"
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
          (v6/*: any*/),
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "EvaluatorConnection",
                "kind": "LinkedField",
                "name": "evaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "evaluator",
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v6/*: any*/),
                          (v2/*: any*/),
                          (v3/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/),
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
                                  (v3/*: any*/),
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
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              (v3/*: any*/)
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
    "cacheID": "0f567409c6eeb367a3e0b569d1c28bcd",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetSectionQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetSectionQuery(\n  $datasetId: ID!\n) {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      evaluators {\n        edges {\n          evaluator: node {\n            __typename\n            id\n            name\n            kind\n            isAssignedToDataset(datasetId: $datasetId)\n            ... on LLMEvaluator {\n              outputConfig {\n                name\n                id\n              }\n            }\n          }\n        }\n      }\n    }\n    ...EvaluatorConfigDialog_dataset\n    id\n  }\n}\n\nfragment EvaluatorConfigDialog_dataset on Dataset {\n  id\n  name\n}\n"
  }
};
})();

(node as any).hash = "ecd663f41f28db292837072fa9acd690";

export default node;
