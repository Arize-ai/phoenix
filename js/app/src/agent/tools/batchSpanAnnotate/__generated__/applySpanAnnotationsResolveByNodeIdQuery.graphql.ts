/**
 * @generated SignedSource<<e4f1566c982294a98d357f4ab71c208b>>
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
  readonly viewer: {
    readonly id: string;
  } | null;
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  (v1/*:: as any*/)
],
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "viewer",
  "plural": false,
  "selections": (v2/*:: as any*/),
  "storageKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanNodeId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "applySpanAnnotationsResolveByNodeIdQuery",
    "selections": [
      (v3/*:: as any*/),
      {
        "alias": "span",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": (v2/*:: as any*/),
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
      (v3/*:: as any*/),
      {
        "alias": "span",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*:: as any*/),
          (v1/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "56a8331327231fa1c734fb5df2a6477a",
    "id": null,
    "metadata": {},
    "name": "applySpanAnnotationsResolveByNodeIdQuery",
    "operationKind": "query",
    "text": "query applySpanAnnotationsResolveByNodeIdQuery(\n  $spanNodeId: ID!\n) {\n  viewer {\n    id\n  }\n  span: node(id: $spanNodeId) {\n    __typename\n    ... on Span {\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "526c87ad6f0498f0502b8b359ee3e018";

export default node;
