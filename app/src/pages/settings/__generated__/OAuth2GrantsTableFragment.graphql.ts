/**
 * @generated SignedSource<<7e0596621443ed7dec9ec6e4b1bbd85d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type OAuth2GrantsTableFragment$data = {
  readonly oauth2Grants: ReadonlyArray<{
    readonly clientId: string;
    readonly clientName: string;
    readonly createdAt: string;
    readonly expiresAt: string | null;
    readonly id: string;
    readonly isFirstParty: boolean;
    readonly lastUsedAt: string | null;
    readonly user: {
      readonly username: string;
    };
  }>;
  readonly " $fragmentType": "OAuth2GrantsTableFragment";
};
export type OAuth2GrantsTableFragment$key = {
  readonly " $data"?: OAuth2GrantsTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"OAuth2GrantsTableFragment">;
};

import OAuth2GrantsTableQuery_graphql from './OAuth2GrantsTableQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": OAuth2GrantsTableQuery_graphql
    }
  },
  "name": "OAuth2GrantsTableFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "OAuth2Grant",
      "kind": "LinkedField",
      "name": "oauth2Grants",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        },
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
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "User",
          "kind": "LinkedField",
          "name": "user",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "username",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "be2ea8a752ec3c9a3cf15cc5bc6165b3";

export default node;
