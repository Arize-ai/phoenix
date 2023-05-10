/**
 * @generated SignedSource<<62e9bd86a7acd0a0273a3e2effbb6873>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
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
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
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
    "cacheID": "03a9aafe3f08a9d093b029ff4a9e3253",
    "id": null,
    "metadata": {},
    "name": "dimensionLoaderQuery",
    "operationKind": "query",
    "text": "query dimensionLoaderQuery(\n  $id: GlobalID!\n) {\n  dimension: node(id: $id) {\n    __typename\n    ... on Dimension {\n      id\n      name\n      dataType\n      shape\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5a662d77e69d2e9bb4eb2af4cad6b722";

export default node;
