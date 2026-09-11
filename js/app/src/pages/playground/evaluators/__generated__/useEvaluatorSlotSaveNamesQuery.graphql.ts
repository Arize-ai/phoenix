/**
 * @generated SignedSource<<a4ff421b56b4799b285219644642c9bf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorFilterColumn = "name";
export type EvaluatorFilter = {
  col: EvaluatorFilterColumn;
  value: string;
};
export type useEvaluatorSlotSaveNamesQuery$variables = {
  filter: EvaluatorFilter;
};
export type useEvaluatorSlotSaveNamesQuery$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly datasetEvaluators: ReadonlyArray<{
          readonly dataset: {
            readonly id: string;
          };
          readonly name: string;
        }>;
        readonly name: string;
      };
    }>;
  };
};
export type useEvaluatorSlotSaveNamesQuery = {
  response: useEvaluatorSlotSaveNamesQuery$data;
  variables: useEvaluatorSlotSaveNamesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "filter",
    "variableName": "filter"
  },
  {
    "kind": "Literal",
    "name": "first",
    "value": 200
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
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "Dataset",
  "kind": "LinkedField",
  "name": "dataset",
  "plural": false,
  "selections": [
    (v3/*:: as any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useEvaluatorSlotSaveNamesQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluator",
                    "kind": "LinkedField",
                    "name": "datasetEvaluators",
                    "plural": true,
                    "selections": [
                      (v2/*:: as any*/),
                      (v4/*:: as any*/)
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
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useEvaluatorSlotSaveNamesQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  (v2/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluator",
                    "kind": "LinkedField",
                    "name": "datasetEvaluators",
                    "plural": true,
                    "selections": [
                      (v2/*:: as any*/),
                      (v4/*:: as any*/),
                      (v3/*:: as any*/)
                    ],
                    "storageKey": null
                  },
                  (v3/*:: as any*/)
                ],
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
    "cacheID": "7d741b6c9fa46cca6e21e5a07aa08049",
    "id": null,
    "metadata": {},
    "name": "useEvaluatorSlotSaveNamesQuery",
    "operationKind": "query",
    "text": "query useEvaluatorSlotSaveNamesQuery(\n  $filter: EvaluatorFilter!\n) {\n  evaluators(first: 200, filter: $filter) {\n    edges {\n      node {\n        __typename\n        name\n        datasetEvaluators {\n          name\n          dataset {\n            id\n          }\n          id\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2909e2b69d8efe47aeb0f21a4022107b";

export default node;
