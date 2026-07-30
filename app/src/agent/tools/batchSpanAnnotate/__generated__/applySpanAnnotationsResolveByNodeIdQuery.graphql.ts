/**
 * @generated SignedSource<<de30cdbc799076aa6c472cf8a17ed1b4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type applySpanAnnotationsResolveByNodeIdQuery$variables = {
  spanNodeId: string;
};
export type applySpanAnnotationsResolveByNodeIdQuery$data = {
  readonly span: {
    readonly __typename: "Span";
    readonly id: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type applySpanAnnotationsResolveByNodeIdQuery = {
  response: applySpanAnnotationsResolveByNodeIdQuery$data;
  variables: applySpanAnnotationsResolveByNodeIdQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanNodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanNodeId"
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "applySpanAnnotationsResolveByNodeIdQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/)
            ],
            "type": "Span",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "applySpanAnnotationsResolveByNodeIdQuery",
    "selections": [
      {
        "alias": "span",
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
    ]
  },
  "params": {
    "cacheID": "07b1480dcc0e95bbadca17e20cbda557",
    "id": null,
    "metadata": {},
    "name": "applySpanAnnotationsResolveByNodeIdQuery",
    "operationKind": "query",
    "text": "query applySpanAnnotationsResolveByNodeIdQuery(\n  $spanNodeId: ID!\n) {\n  span: node(id: $spanNodeId) {\n    __typename\n    ... on Span {\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "a291c84014acc12a7083af94cb6be5fc";

export default node;
