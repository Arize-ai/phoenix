/**
 * @generated SignedSource<<7f812cd35c98dc06f21fe0aa5ceb7227>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type refreshDatasetSplitsQuery$variables = Record<PropertyKey, never>;
export type refreshDatasetSplitsQuery$data = {
  readonly datasetSplits: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type refreshDatasetSplitsQuery = {
  response: refreshDatasetSplitsQuery$data;
  variables: refreshDatasetSplitsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "DatasetSplitConnection",
    "kind": "LinkedField",
    "name": "datasetSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplitEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetSplit",
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
                "name": "description",
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
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "refreshDatasetSplitsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "refreshDatasetSplitsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "4eac7e3ac99ec200e06ee29a7df0547c",
    "id": null,
    "metadata": {},
    "name": "refreshDatasetSplitsQuery",
    "operationKind": "query",
    "text": "query refreshDatasetSplitsQuery {\n  datasetSplits {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "73856b60e9ea8c3b1de929ff5865d37e";

export default node;
