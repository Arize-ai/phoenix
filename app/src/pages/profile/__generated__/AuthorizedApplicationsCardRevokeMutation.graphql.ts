/**
 * @generated SignedSource<<9aad0c8c3f3d1b4a49b0b9b4554f3146>>
 * @lightSyntaxTransform
 * @nogrep
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
};
export type AuthorizedApplicationsCardRevokeMutation$data = {
  readonly revokeOAuth2Grant: {
    readonly grantId: string;
    readonly query: {
      readonly viewer: {
        readonly " $fragmentSpreads": FragmentRefs<"AuthorizedApplicationsCardFragment">;
      } | null;
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AuthorizedApplicationsCardRevokeMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RevokeOAuth2GrantMutationPayload",
        "kind": "LinkedField",
        "name": "revokeOAuth2Grant",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "viewer",
                "plural": false,
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "AuthorizedApplicationsCardFragment"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AuthorizedApplicationsCardRevokeMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "RevokeOAuth2GrantMutationPayload",
        "kind": "LinkedField",
        "name": "revokeOAuth2Grant",
        "plural": false,
        "selections": [
          (v2/*: any*/),
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
                "args": null,
                "concreteType": "User",
                "kind": "LinkedField",
                "name": "viewer",
                "plural": false,
                "selections": [
                  (v3/*: any*/),
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
    "cacheID": "c6f9fa29605956cd81d7398de534ecef",
    "id": null,
    "metadata": {},
    "name": "AuthorizedApplicationsCardRevokeMutation",
    "operationKind": "mutation",
    "text": "mutation AuthorizedApplicationsCardRevokeMutation(\n  $input: RevokeOAuth2GrantInput!\n) {\n  revokeOAuth2Grant(input: $input) {\n    grantId\n    query {\n      viewer {\n        ...AuthorizedApplicationsCardFragment\n        id\n      }\n    }\n  }\n}\n\nfragment AuthorizedApplicationsCardFragment on User {\n  id\n  oauth2Grants {\n    id\n    clientName\n    clientId\n    isFirstParty\n    scopes\n    createdAt\n    expiresAt\n    lastUsedAt\n  }\n}\n"
  }
};
})();

(node as any).hash = "9b767f6aa1d00fefd84518599dddc70e";

export default node;
