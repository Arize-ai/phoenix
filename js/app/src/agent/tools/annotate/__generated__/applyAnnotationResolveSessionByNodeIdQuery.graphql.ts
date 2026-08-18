/**
 * @generated SignedSource<<1c5f13b6281ff47e346a395f3856da06>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type applyAnnotationResolveSessionByNodeIdQuery$variables = {
  sessionNodeId: string;
};
export type applyAnnotationResolveSessionByNodeIdQuery$data = {
  readonly session: {
    readonly __typename: "ProjectSession";
    readonly id: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type applyAnnotationResolveSessionByNodeIdQuery = {
  response: applyAnnotationResolveSessionByNodeIdQuery$data;
  variables: applyAnnotationResolveSessionByNodeIdQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "sessionNodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "sessionNodeId"
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
    "name": "applyAnnotationResolveSessionByNodeIdQuery",
    "selections": [
      {
        "alias": "session",
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
            "type": "ProjectSession",
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
    "name": "applyAnnotationResolveSessionByNodeIdQuery",
    "selections": [
      {
        "alias": "session",
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
    "cacheID": "2981a893b0728303826f09d06a61347d",
    "id": null,
    "metadata": {},
    "name": "applyAnnotationResolveSessionByNodeIdQuery",
    "operationKind": "query",
    "text": "query applyAnnotationResolveSessionByNodeIdQuery(\n  $sessionNodeId: ID!\n) {\n  session: node(id: $sessionNodeId) {\n    __typename\n    ... on ProjectSession {\n      id\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "59912e1691dcc0bfacfc82204fc81834";

export default node;
