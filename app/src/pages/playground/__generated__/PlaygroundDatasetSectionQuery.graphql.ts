/**
 * @generated SignedSource<<d7ab6bbbc5b5209d5d24ab1d2b6edf1e>>
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
  splitIds?: ReadonlyArray<string> | null;
};
export type PlaygroundDatasetSectionQuery$data = {
  readonly dataset: {
    readonly exampleCount?: number;
    readonly name?: string;
    readonly splits?: ReadonlyArray<{
      readonly color: string;
      readonly id: string;
      readonly name: string;
    }>;
    readonly " $fragmentSpreads": FragmentRefs<"EvaluatorConfigDialog_dataset">;
  };
  readonly evaluators: {
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "kind",
  "storageKey": null
},
v4 = {
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
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v6 = {
  "kind": "InlineFragment",
  "selections": [
    (v2/*: any*/),
    {
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
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetSplit",
      "kind": "LinkedField",
      "name": "splits",
      "plural": true,
      "selections": [
        (v1/*: any*/),
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
    }
  ],
  "type": "Dataset",
  "abstractKey": null
},
v7 = {
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
                  (v1/*: any*/),
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
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
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": "dataset",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
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
                  (v7/*: any*/),
                  (v1/*: any*/),
                  (v2/*: any*/),
                  (v3/*: any*/),
                  (v4/*: any*/),
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
                          (v1/*: any*/)
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
      {
        "alias": "dataset",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/),
          (v1/*: any*/),
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4882eb588fc8b57622cf0ff0ea645eb2",
    "id": null,
    "metadata": {},
    "name": "PlaygroundDatasetSectionQuery",
    "operationKind": "query",
    "text": "query PlaygroundDatasetSectionQuery(\n  $datasetId: ID!\n  $splitIds: [ID!]\n) {\n  evaluators {\n    edges {\n      evaluator: node {\n        __typename\n        id\n        name\n        kind\n        isAssignedToDataset(datasetId: $datasetId)\n        ... on LLMEvaluator {\n          outputConfig {\n            name\n            id\n          }\n        }\n      }\n    }\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      name\n      exampleCount(splitIds: $splitIds)\n      splits {\n        id\n        name\n        color\n      }\n    }\n    ...EvaluatorConfigDialog_dataset\n    id\n  }\n}\n\nfragment EvaluatorConfigDialog_dataset on Dataset {\n  id\n  name\n}\n"
  }
};
})();

(node as any).hash = "2f503a4a49b55157153d6e457a836c8b";

export default node;
