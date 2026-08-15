/**
 * @generated SignedSource<<260203bb762e33a0d5d434c1e907e2f4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type IOValueTooltipCellSessionOutputQuery$variables = {
  id: string;
};
export type IOValueTooltipCellSessionOutputQuery$data = {
  readonly node: {
    readonly lastOutput?: {
      readonly value: string;
    } | null;
  };
};
export type IOValueTooltipCellSessionOutputQuery = {
  response: IOValueTooltipCellSessionOutputQuery$data;
  variables: IOValueTooltipCellSessionOutputQuery$variables;
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanIOValue",
      "kind": "LinkedField",
      "name": "lastOutput",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "value",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectSession",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "IOValueTooltipCellSessionOutputQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
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
    "name": "IOValueTooltipCellSessionOutputQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
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
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "ed51e7940409840f8115bcf160873550",
    "id": null,
    "metadata": {},
    "name": "IOValueTooltipCellSessionOutputQuery",
    "operationKind": "query",
    "text": "query IOValueTooltipCellSessionOutputQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      lastOutput {\n        value\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3d0b3578e103ebd997174318bee044a1";

export default node;
