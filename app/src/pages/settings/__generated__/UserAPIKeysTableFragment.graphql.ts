/**
 * @generated SignedSource<<714f06c8939bc67ed12cdd4d9b5c7c8c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UserAPIKeysTableFragment$data = {
  readonly userApiKeys: ReadonlyArray<{
    readonly createdAt: string;
    readonly description: string | null;
    readonly expiresAt: string | null;
    readonly id: string;
    readonly name: string;
    readonly user: {
      readonly email: string | null;
    };
  }>;
  readonly " $fragmentType": "UserAPIKeysTableFragment";
};
export type UserAPIKeysTableFragment$key = {
  readonly " $data"?: UserAPIKeysTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"UserAPIKeysTableFragment">;
};

import UserAPIKeysTableQuery_graphql from './UserAPIKeysTableQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": UserAPIKeysTableQuery_graphql
    }
  },
  "name": "UserAPIKeysTableFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "UserApiKey",
      "kind": "LinkedField",
      "name": "userApiKeys",
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
          "name": "name",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "description",
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
          "concreteType": "User",
          "kind": "LinkedField",
          "name": "user",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "email",
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

(node as any).hash = "c2b3a579bcb0ba915523ecb35cae3b44";

export default node;
