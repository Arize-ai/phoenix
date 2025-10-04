/**
 * @generated SignedSource<<117e3825a691a02d5e38e3e9df5107b5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DatasetLabelFilterButtonQuery$variables = Record<PropertyKey, never>;
export type DatasetLabelFilterButtonQuery$data = {
  readonly datasetLabels: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type DatasetLabelFilterButtonQuery = {
  response: DatasetLabelFilterButtonQuery$data;
  variables: DatasetLabelFilterButtonQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Literal",
        "name": "first",
        "value": 100
      }
    ],
    "concreteType": "DatasetLabelConnection",
    "kind": "LinkedField",
    "name": "datasetLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetLabelEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetLabel",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              },
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
        "storageKey": null
      }
    ],
    "storageKey": "datasetLabels(first:100)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetLabelFilterButtonQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DatasetLabelFilterButtonQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "69af78a99af4ee24a2e6a4af1658c6e6",
    "id": null,
    "metadata": {},
    "name": "DatasetLabelFilterButtonQuery",
    "operationKind": "query",
    "text": "query DatasetLabelFilterButtonQuery {\n  datasetLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2962530bee1afc7c2ed0fc335ca45b17";

export default node;
