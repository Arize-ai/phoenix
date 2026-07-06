/**
 * @generated SignedSource<<0c59d437d89c4f6af8cd0416e2819461>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type loadPlaygroundDatasetResolveQuery$variables = {
  first: number;
  name: string;
};
export type loadPlaygroundDatasetResolveQuery$data = {
  readonly datasets: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly exampleCount: number;
        readonly id: string;
        readonly name: string;
        readonly splits: ReadonlyArray<{
          readonly id: string;
          readonly name: string;
        }>;
      };
    }>;
  };
};
export type loadPlaygroundDatasetResolveQuery = {
  response: loadPlaygroundDatasetResolveQuery$data;
  variables: loadPlaygroundDatasetResolveQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
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
v4 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Literal",
            "name": "col",
            "value": "name"
          },
          {
            "kind": "Variable",
            "name": "value",
            "variableName": "name"
          }
        ],
        "kind": "ObjectValue",
        "name": "filter"
      },
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "first"
      }
    ],
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
              (v2/*: any*/),
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
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
                  (v2/*: any*/),
                  (v3/*: any*/)
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
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "loadPlaygroundDatasetResolveQuery",
    "selections": (v4/*: any*/),
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
    "name": "loadPlaygroundDatasetResolveQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "0ee3f0d398602326eb7fe7ac93b87a10",
    "id": null,
    "metadata": {},
    "name": "loadPlaygroundDatasetResolveQuery",
    "operationKind": "query",
    "text": "query loadPlaygroundDatasetResolveQuery(\n  $name: String!\n  $first: Int!\n) {\n  datasets(filter: {col: name, value: $name}, first: $first) {\n    edges {\n      node {\n        id\n        name\n        exampleCount\n        splits {\n          id\n          name\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "36b7707a45c509d5e0203d856f315b56";

export default node;
