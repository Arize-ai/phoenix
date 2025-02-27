/**
 * @generated SignedSource<<9c3a56ed50eccfb9b192f6658da78c50>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type embeddingLoaderQuery$variables = {
  id: string;
};
export type embeddingLoaderQuery$data = {
  readonly embedding: {
    readonly id?: string;
    readonly name?: string;
  };
};
export type embeddingLoaderQuery = {
  response: embeddingLoaderQuery$data;
  variables: embeddingLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "embeddingLoaderQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/)
            ],
            "type": "EmbeddingDimension",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "embeddingLoaderQuery",
    "selections": [
      {
        "alias": "embedding",
        "args": (v1/*: any*/),
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
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/)
            ],
            "type": "EmbeddingDimension",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "cff0ac130f1ef79784f7bef4161ac60d",
    "id": null,
    "metadata": {},
    "name": "embeddingLoaderQuery",
    "operationKind": "query",
    "text": "query embeddingLoaderQuery(\n  $id: GlobalID!\n) {\n  embedding: node(id: $id) {\n    __typename\n    ... on EmbeddingDimension {\n      id\n      name\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "c049e57d92943f64b5e751e0daa89dc8";

export default node;
