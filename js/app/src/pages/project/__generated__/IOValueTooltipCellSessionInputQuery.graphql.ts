/**
 * @generated SignedSource<<7f0dd54bbe91f2d987ca6cb48739754c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type IOValueTooltipCellSessionInputQuery$variables = {
  id: string;
};
export type IOValueTooltipCellSessionInputQuery$data = {
  readonly node: {
    readonly firstInput?: {
      readonly value: string;
    } | null;
  };
};
export type IOValueTooltipCellSessionInputQuery = {
  response: IOValueTooltipCellSessionInputQuery$data;
  variables: IOValueTooltipCellSessionInputQuery$variables;
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
      "name": "firstInput",
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
    "name": "IOValueTooltipCellSessionInputQuery",
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
    "name": "IOValueTooltipCellSessionInputQuery",
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
    "cacheID": "a5a5419a016cfd90dfc56d4b18cdf756",
    "id": null,
    "metadata": {},
    "name": "IOValueTooltipCellSessionInputQuery",
    "operationKind": "query",
    "text": "query IOValueTooltipCellSessionInputQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on ProjectSession {\n      firstInput {\n        value\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "7e14e428247e0f79d5f004b368eea044";

export default node;
