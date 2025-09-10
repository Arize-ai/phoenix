/**
 * @generated SignedSource<<c7d31af5d415dcaf6b6ea751c5b24a48>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DimensionDataType = "categorical" | "numeric";
export type DimensionShape = "continuous" | "discrete";
export type dimensionLoaderQuery$variables = {
  id: string;
};
export type dimensionLoaderQuery$data = {
  readonly dimension: {
    readonly dataType?: DimensionDataType;
    readonly id?: string;
    readonly name?: string;
    readonly shape?: DimensionShape;
  };
};
export type dimensionLoaderQuery = {
  response: dimensionLoaderQuery$data;
  variables: dimensionLoaderQuery$variables;
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
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "dataType",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "shape",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "dimensionLoaderQuery",
    "selections": [
      {
        "alias": "dimension",
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
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/)
            ],
            "type": "Dimension",
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
    "name": "dimensionLoaderQuery",
    "selections": [
      {
        "alias": "dimension",
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
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/)
            ],
            "type": "Dimension",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f16f279b01e4bc5c5261bbdb629a0b73",
    "id": null,
    "metadata": {},
    "name": "dimensionLoaderQuery",
    "operationKind": "query",
    "text": "query dimensionLoaderQuery(\n  $id: ID!\n) {\n  dimension: node(id: $id) {\n    __typename\n    ... on Dimension {\n      id\n      name\n      dataType\n      shape\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "00f0d45ac038a51b4b30d9c5251f701e";

export default node;
