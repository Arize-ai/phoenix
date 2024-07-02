/**
 * @generated SignedSource<<58cdd7ce9d57218242ed040ea81d233a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type datasetsLoaderQuery$variables = Record<PropertyKey, never>;
export type datasetsLoaderQuery$data = {
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly createdAt: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type datasetsLoaderQuery = {
  response: datasetsLoaderQuery$data;
  variables: datasetsLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "DatasetConnection",
    "kind": "LinkedField",
    "name": "datasets",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Dataset",
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
                "name": "createdAt",
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
    "name": "datasetsLoaderQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "datasetsLoaderQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "b5927e971930539a17432299fb05c9f7",
    "id": null,
    "metadata": {},
    "name": "datasetsLoaderQuery",
    "operationKind": "query",
    "text": "query datasetsLoaderQuery {\n  datasets {\n    edges {\n      node {\n        id\n        name\n        description\n        createdAt\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5a5aa33eb69d5eb3d2b5c68d1932685e";

export default node;
