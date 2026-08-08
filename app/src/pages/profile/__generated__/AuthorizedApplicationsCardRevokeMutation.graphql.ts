/**
 * @generated SignedSource<<e07bd67151505df1e3583074aa47b9f0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type RevokeOAuth2GrantInput = {
  id: string;
};
export type AuthorizedApplicationsCardRevokeMutation$variables = {
  input: RevokeOAuth2GrantInput;
  userId: string;
};
export type AuthorizedApplicationsCardRevokeMutation$data = {
  readonly revokeOAuth2Grant: {
    readonly grantId: string;
    readonly query: {
      readonly node: {
        readonly oauth2GrantCount?: number;
        readonly " $fragmentSpreads": FragmentRefs<"AuthorizedApplicationsCardFragment">;
      };
    };
  };
};
export type AuthorizedApplicationsCardRevokeMutation = {
  response: AuthorizedApplicationsCardRevokeMutation$data;
  variables: AuthorizedApplicationsCardRevokeMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "userId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "grantId",
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "userId"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "oauth2GrantCount",
  "storageKey": null
},
v5 = {
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
    "name": "AuthorizedApplicationsCardRevokeMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "RevokeOAuth2GrantMutationPayload",
        "kind": "LinkedField",
        "name": "revokeOAuth2Grant",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v4/*:: as any*/),
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
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "AuthorizedApplicationsCardRevokeMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "RevokeOAuth2GrantMutationPayload",
        "kind": "LinkedField",
        "name": "revokeOAuth2Grant",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
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
                  (v5/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v4/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "OAuth2Grant",
                        "kind": "LinkedField",
                        "name": "oauth2Grants",
                        "plural": true,
                        "selections": [
                          (v5/*:: as any*/),
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
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "createdAt",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "expiresAt",
                            "storageKey": null
                          },
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
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4860bb50fa0418ca30310d4c1e2ed510",
    "id": null,
    "metadata": {},
    "name": "AuthorizedApplicationsCardRevokeMutation",
    "operationKind": "mutation",
    "text": "mutation AuthorizedApplicationsCardRevokeMutation(\n  $input: RevokeOAuth2GrantInput!\n  $userId: ID!\n) {\n  revokeOAuth2Grant(input: $input) {\n    grantId\n    query {\n      node(id: $userId) {\n        __typename\n        ... on User {\n          oauth2GrantCount\n          ...AuthorizedApplicationsCardFragment\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment AuthorizedApplicationsCardFragment on User {\n  id\n  oauth2Grants {\n    id\n    clientName\n    clientId\n    isFirstParty\n    scopes\n    createdAt\n    expiresAt\n    lastUsedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "e92b6ced7988d11769bb65de1355f809";

export default node;
