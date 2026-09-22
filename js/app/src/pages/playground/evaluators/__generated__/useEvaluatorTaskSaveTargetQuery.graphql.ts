/**
 * @generated SignedSource<<40435250a831ffc892a21ac55a6430f8>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorKind = "BUILTIN" | "CODE" | "LLM";
export type useEvaluatorTaskSaveTargetQuery$variables = {
  datasetEvaluatorId: string;
  evaluatorId: string;
  hasDatasetEvaluator: boolean;
  hasEvaluator: boolean;
};
export type useEvaluatorTaskSaveTargetQuery$data = {
  readonly datasetEvaluator?: {
    readonly dataset?: {
      readonly id: string;
    };
    readonly id?: string;
  };
  readonly evaluator?: {
    readonly datasetEvaluators?: ReadonlyArray<{
      readonly dataset: {
        readonly id: string;
      };
      readonly id: string;
    }>;
    readonly id?: string;
    readonly kind?: EvaluatorKind;
  };
};
export type useEvaluatorTaskSaveTargetQuery = {
  response: useEvaluatorTaskSaveTargetQuery$data;
  variables: useEvaluatorTaskSaveTargetQuery$variables;
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
  "name": "evaluatorId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasDatasetEvaluator"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasEvaluator"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "evaluatorId"
  }
],
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
  "name": "kind",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "dataset",
  "plural": false,
  "selections": [
    (v5/*:: as any*/)
  ],
  "storageKey": null
},
v8 = [
  (v5/*:: as any*/),
  (v7/*:: as any*/)
],
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "DatasetEvaluator",
  "kind": "LinkedField",
  "name": "datasetEvaluators",
  "plural": true,
  "selections": (v8/*:: as any*/),
  "storageKey": null
},
v10 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetEvaluatorId"
  }
],
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useEvaluatorTaskSaveTargetQuery",
    "selections": [
      {
        "condition": "hasEvaluator",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "evaluator",
            "args": (v4/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v5/*:: as any*/),
                  (v6/*:: as any*/),
                  (v9/*:: as any*/)
                ],
                "type": "Evaluator",
                "abstractKey": "__isEvaluator"
              }
            ],
            "storageKey": null
          }
        ]
      },
      {
        "condition": "hasDatasetEvaluator",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "datasetEvaluator",
            "args": (v10/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": (v8/*:: as any*/),
                "type": "DatasetEvaluator",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v3/*:: as any*/),
      (v0/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "useEvaluatorTaskSaveTargetQuery",
    "selections": [
      {
        "condition": "hasEvaluator",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "evaluator",
            "args": (v4/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v11/*:: as any*/),
              (v5/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v6/*:: as any*/),
                  (v9/*:: as any*/)
                ],
                "type": "Evaluator",
                "abstractKey": "__isEvaluator"
              }
            ],
            "storageKey": null
          }
        ]
      },
      {
        "condition": "hasDatasetEvaluator",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "datasetEvaluator",
            "args": (v10/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v11/*:: as any*/),
              (v5/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v7/*:: as any*/)
                ],
                "type": "DatasetEvaluator",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "0e3bd96bf7959fc23b434ddf34baf298",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorTaskSaveTargetQuery",
    "operationKind": "query",
    "text": "query useEvaluatorTaskSaveTargetQuery(\n  $evaluatorId: ID!\n  $hasEvaluator: Boolean!\n  $datasetEvaluatorId: ID!\n  $hasDatasetEvaluator: Boolean!\n) {\n  evaluator: node(id: $evaluatorId) @include(if: $hasEvaluator) {\n    __typename\n    ... on Evaluator {\n      __isEvaluator: __typename\n      id\n      kind\n      datasetEvaluators {\n        id\n        dataset {\n          id\n        }\n      }\n    }\n    id\n  }\n  datasetEvaluator: node(id: $datasetEvaluatorId) @include(if: $hasDatasetEvaluator) {\n    __typename\n    ... on DatasetEvaluator {\n      id\n      dataset {\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "70875f7c16f9e30bc4eae6ab5df36566";

export default node;
