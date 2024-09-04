/**
 * @generated SignedSource<<e141c2d64acfb347734a53445e9a59e2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UserAPIKeysTableFragment$data = {
  readonly userApiKeys: ReadonlyArray<{
    readonly createdAt: string;
    readonly description: string | null;
    readonly expiresAt: string | null;
    readonly id: string;
    readonly name: string;
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "b74ea37cf5a935ebe3ce165a42a5fbf7";

export default node;
