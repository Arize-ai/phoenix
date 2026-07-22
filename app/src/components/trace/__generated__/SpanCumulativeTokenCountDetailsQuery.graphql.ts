/**
 * @generated SignedSource<<317f7db06bcb9b75de9f08ef6d676808>>
 * @lightSyntaxTransform
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanCumulativeTokenCountDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/)
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
    "name": "SpanCumulativeTokenCountDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
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
