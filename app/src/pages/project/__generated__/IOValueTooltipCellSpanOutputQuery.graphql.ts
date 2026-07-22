/**
 * @generated SignedSource<<1a70767da1e46b2f6f429e2fe23f84e2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type IOValueTooltipCellSpanOutputQuery$variables = {
  id: string;
};
export type IOValueTooltipCellSpanOutputQuery$data = {
  readonly node: {
    readonly output?: {
      readonly value: string;
    } | null;
  };
};
export type IOValueTooltipCellSpanOutputQuery = {
  response: IOValueTooltipCellSpanOutputQuery$data;
  variables: IOValueTooltipCellSpanOutputQuery$variables;
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
      "name": "output",
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
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "IOValueTooltipCellSpanOutputQuery",
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
    "name": "IOValueTooltipCellSpanOutputQuery",
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
    "cacheID": "b67e49d784cb6f5ce71d6e8adebdf8d6",
    "id": null,
    "metadata": {},
    "name": "IOValueTooltipCellSpanOutputQuery",
    "operationKind": "query",
    "text": "query IOValueTooltipCellSpanOutputQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Span {\n      output {\n        value\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "73507cf9d0747c48095e59076c597bf7";

export default node;
