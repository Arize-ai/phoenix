/**
 * @generated SignedSource<<12d19b166170b79558281848bbd136be>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type authenticatedRootLoaderQuery$variables = Record<PropertyKey, never>;
export type authenticatedRootLoaderQuery$data = {
  readonly agentsConfig: {
    readonly allowLocalTraces: boolean;
    readonly allowRemoteExport: boolean;
    readonly assistantEnabled: boolean;
    readonly assistantProjectName: string;
    readonly collectorEndpoint: string | null;
    readonly forceTracing: boolean;
    readonly webAccessEnabled: boolean;
  };
  readonly viewer: {
    readonly email: string | null;
    readonly id: string;
    readonly passwordNeedsReset: boolean;
    readonly username: string;
  } | null;
  readonly " $fragmentSpreads": FragmentRefs<"ViewerContext_viewer">;
};
export type authenticatedRootLoaderQuery = {
  response: authenticatedRootLoaderQuery$data;
  variables: authenticatedRootLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "concreteType": "AgentsConfig",
  "kind": "LinkedField",
  "name": "agentsConfig",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "collectorEndpoint",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "assistantProjectName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "forceTracing",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "webAccessEnabled",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "assistantEnabled",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "allowLocalTraces",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "allowRemoteExport",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "email",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "passwordNeedsReset",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "expiresAt",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "authenticatedRootLoaderQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ViewerContext_viewer"
      },
      (v0/*: any*/),
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "authenticatedRootLoaderQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "User",
        "kind": "LinkedField",
        "name": "viewer",
        "plural": false,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "profilePictureUrl",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isManagementUser",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "UserRole",
            "kind": "LinkedField",
            "name": "role",
            "plural": false,
            "selections": [
              (v5/*: any*/),
              (v1/*: any*/)
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "authMethod",
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
              (v1/*: any*/),
              (v5/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "description",
                "storageKey": null
              },
              (v6/*: any*/),
              (v7/*: any*/)
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
              (v1/*: any*/),
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
              (v6/*: any*/),
              (v7/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "lastUsedAt",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      },
      (v0/*: any*/)
    ]
  },
  "params": {
    "cacheID": "9fbcf32bbba93b28c158cc7ac16ff1d3",
    "id": null,
    "metadata": {},
    "name": "authenticatedRootLoaderQuery",
    "operationKind": "query",
    "text": "query authenticatedRootLoaderQuery {\n  ...ViewerContext_viewer\n  agentsConfig {\n    collectorEndpoint\n    assistantProjectName\n    forceTracing\n    webAccessEnabled\n    assistantEnabled\n    allowLocalTraces\n    allowRemoteExport\n  }\n  viewer {\n    id\n    username\n    email\n    passwordNeedsReset\n  }\n}\n\nfragment APIKeysTableFragment on User {\n  apiKeys {\n    id\n    name\n    description\n    createdAt\n    expiresAt\n  }\n  id\n}\n\nfragment AuthorizedApplicationsCardFragment on User {\n  id\n  oauth2Grants {\n    id\n    clientName\n    clientId\n    isFirstParty\n    scopes\n    createdAt\n    expiresAt\n    lastUsedAt\n  }\n}\n\nfragment ViewerContext_viewer on Query {\n  viewer {\n    id\n    username\n    email\n    profilePictureUrl\n    isManagementUser\n    role {\n      name\n      id\n    }\n    authMethod\n    ...APIKeysTableFragment\n    ...AuthorizedApplicationsCardFragment\n  }\n}\n"
  }
};
})();

(node as any).hash = "5664be46b399644bab48856bc94821a0";

export default node;
