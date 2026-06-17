/**
 * @generated SignedSource<<560bdcb4d60681194b2fe15c76948904>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UserAccessDialogQuery$variables = {
  userId: string;
};
export type UserAccessDialogQuery$data = {
  readonly node: {
    readonly accessSummary?: {
      readonly allDatasets: boolean;
      readonly allProjects: boolean;
      readonly allPrompts: boolean;
      readonly isAdmin: boolean;
      readonly objects: ReadonlyArray<{
        readonly id: string;
        readonly kind: string;
        readonly name: string;
      }>;
    };
  };
};
export type UserAccessDialogQuery = {
  response: UserAccessDialogQuery$data;
  variables: UserAccessDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "userId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "userId"
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
      "concreteType": "UserAccessSummary",
      "kind": "LinkedField",
      "name": "accessSummary",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isAdmin",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "allProjects",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "allDatasets",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "allPrompts",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "AccessibleObjectRef",
          "kind": "LinkedField",
          "name": "objects",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "kind",
              "storageKey": null
            },
            (v2/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "name",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "UserAccessDialogQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
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
    "name": "UserAccessDialogQuery",
    "selections": [
      {
        "alias": null,
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
          (v3/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e1bea8c5208150f3449cd479a15578cf",
    "id": null,
    "metadata": {},
    "name": "UserAccessDialogQuery",
    "operationKind": "query",
    "text": "query UserAccessDialogQuery(\n  $userId: ID!\n) {\n  node(id: $userId) {\n    __typename\n    ... on User {\n      accessSummary {\n        isAdmin\n        allProjects\n        allDatasets\n        allPrompts\n        objects {\n          kind\n          id\n          name\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "821a3a03f7ebfaa77c4c157707c048ff";

export default node;
