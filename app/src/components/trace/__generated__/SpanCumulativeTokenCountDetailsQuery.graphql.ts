/**
 * @generated SignedSource<<7ae6f2f0adad6693e46b124bfee49656>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanCumulativeTokenCountDetailsQuery$variables = {
  nodeId: string;
};
export type SpanCumulativeTokenCountDetailsQuery$data = {
  readonly node: {
    readonly __typename: "Span";
    readonly cumulativeTokenCountCompletion: number | null;
    readonly cumulativeTokenCountPrompt: number | null;
    readonly cumulativeTokenCountTotal: number | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SpanCumulativeTokenCountDetailsQuery = {
  response: SpanCumulativeTokenCountDetailsQuery$data;
  variables: SpanCumulativeTokenCountDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "nodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "nodeId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "cumulativeTokenCountTotal",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "cumulativeTokenCountPrompt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "cumulativeTokenCountCompletion",
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanCumulativeTokenCountDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v3/*: any*/)
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
    "name": "SpanCumulativeTokenCountDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
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
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c1da825bac7aac7aafa07638290f6f1d",
    "id": null,
    "metadata": {},
    "name": "SpanCumulativeTokenCountDetailsQuery",
    "operationKind": "query",
    "text": "query SpanCumulativeTokenCountDetailsQuery(\n  $nodeId: ID!\n) {\n  node(id: $nodeId) {\n    __typename\n    ... on Span {\n      cumulativeTokenCountTotal\n      cumulativeTokenCountPrompt\n      cumulativeTokenCountCompletion\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f7a968d87890a07d6e1dd6f06bad6b51";

export default node;
