/**
 * @generated SignedSource<<91e796da5a7c5712bc64d5eb87386c7a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type sessionLoaderQuery$variables = {
  id: string;
};
export type sessionLoaderQuery$data = {
  readonly session: {
    readonly id: string;
    readonly sessionId?: string;
  };
};
export type sessionLoaderQuery = {
  response: sessionLoaderQuery$data;
  variables: sessionLoaderQuery$variables;
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sessionId",
      "storageKey": null
    }
  ],
  "type": "ProjectSession",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "sessionLoaderQuery",
    "selections": [
      {
        "alias": "session",
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
    "name": "sessionLoaderQuery",
    "selections": [
      {
        "alias": "session",
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
          (v2/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "aa110794a0fd7ac02812e8e14196930b",
    "id": null,
    "metadata": {},
    "name": "sessionLoaderQuery",
    "operationKind": "query",
    "text": "query sessionLoaderQuery(\n  $id: GlobalID!\n) {\n  session: node(id: $id) {\n    __typename\n    id\n    ... on ProjectSession {\n      sessionId\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "26e5a5dbde9bd4ecfd7ae5fc1c078860";

export default node;
