/**
 * @generated SignedSource<<25e74b15638c7ef62b8885ab54c65d15>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AuthMethod = "LDAP" | "LOCAL" | "OAUTH2";
export type UserDetailsDrawerQuery$variables = {
  userId: string;
};
export type UserDetailsDrawerQuery$data = {
  readonly node: {
    readonly __typename: "User";
    readonly authMethod: AuthMethod;
    readonly createdAt: string;
    readonly email: string | null;
    readonly id: string;
    readonly profilePictureUrl: string | null;
    readonly role: {
      readonly name: string;
    };
    readonly username: string;
    readonly " $fragmentSpreads": FragmentRefs<"AuthorizedApplicationsCardFragment" | "UserAPIKeysCardFragment">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type UserDetailsDrawerQuery = {
  response: UserDetailsDrawerQuery$data;
  variables: UserDetailsDrawerQuery$variables;
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
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "email",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "authMethod",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "expiresAt",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "UserDetailsDrawerQuery",
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "UserRole",
                "kind": "LinkedField",
                "name": "role",
                "plural": false,
                "selections": [
                  (v9/*: any*/)
                ],
                "storageKey": null
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "UserAPIKeysCardFragment"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "AuthorizedApplicationsCardFragment"
              }
            ],
            "type": "User",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "UserDetailsDrawerQuery",
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
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "UserRole",
                "kind": "LinkedField",
                "name": "role",
                "plural": false,
                "selections": [
                  (v9/*: any*/),
                  (v3/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "UserApiKey",
                "kind": "LinkedField",
                "name": "apiKeys",
                "plural": true,
                "selections": [
                  (v3/*: any*/),
                  (v9/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "description",
                    "storageKey": null
                  },
                  (v7/*: any*/),
                  (v10/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "OAuth2Grant",
                "kind": "LinkedField",
                "name": "oauth2Grants",
                "plural": true,
                "selections": [
                  (v3/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "clientName",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "clientId",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "isFirstParty",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "scopes",
                    "storageKey": null
                  },
                  (v7/*: any*/),
                  (v10/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "lastUsedAt",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "User",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "814e036a48f3caf5deccc1c989ff4f8e",
    "id": null,
    "metadata": {},
    "name": "UserDetailsDrawerQuery",
    "operationKind": "query",
    "text": "query UserDetailsDrawerQuery(\n  $userId: ID!\n) {\n  node(id: $userId) {\n    __typename\n    ... on User {\n      id\n      username\n      email\n      authMethod\n      createdAt\n      profilePictureUrl\n      role {\n        name\n        id\n      }\n      ...UserAPIKeysCardFragment\n      ...AuthorizedApplicationsCardFragment\n    }\n    id\n  }\n}\n\nfragment AuthorizedApplicationsCardFragment on User {\n  id\n  oauth2Grants {\n    id\n    clientName\n    clientId\n    isFirstParty\n    scopes\n    createdAt\n    expiresAt\n    lastUsedAt\n  }\n}\n\nfragment UserAPIKeysCardFragment on User {\n  id\n  apiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "6751c48c4103f17c69c160be3335cd23";

export default node;
