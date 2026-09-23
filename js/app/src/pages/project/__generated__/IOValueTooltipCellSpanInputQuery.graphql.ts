/**
 * @generated SignedSource<<be28a254c1c187be21de20b6d16e1b26>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type IOValueTooltipCellSpanInputQuery$variables = {
  id: string;
};
export type IOValueTooltipCellSpanInputQuery$data = {
  readonly node: {
    readonly input?: {
      readonly value: string;
    } | null;
  };
};
export type IOValueTooltipCellSpanInputQuery = {
  response: IOValueTooltipCellSpanInputQuery$data;
  variables: IOValueTooltipCellSpanInputQuery$variables;
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
      "name": "input",
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
    "name": "IOValueTooltipCellSpanInputQuery",
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
    "name": "IOValueTooltipCellSpanInputQuery",
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
    "cacheID": "97941f10219e8a6334dc13f781036a74",
    "id": null,
    "metadata": {},
    "name": "IOValueTooltipCellSpanInputQuery",
    "operationKind": "query",
    "text": "query IOValueTooltipCellSpanInputQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ... on Span {\n      input {\n        value\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "731ad44736b050d7a009d4114d526748";

export default node;
