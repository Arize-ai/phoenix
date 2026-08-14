/**
 * @generated SignedSource<<3b8957e02133ee0a8451eebe5a95b4e2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SystemAPIKeysTableFragment$data = {
  readonly systemApiKeys: ReadonlyArray<{
    readonly createdAt: string;
    readonly description: string | null;
    readonly expiresAt: string | null;
    readonly id: string;
    readonly name: string;
  }>;
  readonly viewer: {
    readonly " $fragmentSpreads": FragmentRefs<"ViewerAPIKeysListFragment">;
  } | null;
  readonly " $fragmentType": "SystemAPIKeysTableFragment";
};
export type SystemAPIKeysTableFragment$key = {
  readonly " $data"?: SystemAPIKeysTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment">;
};

import SystemAPIKeysTableQuery_graphql from './SystemAPIKeysTableQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": SystemAPIKeysTableQuery_graphql
    }
  },
  "name": "SystemAPIKeysTableFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SystemApiKey",
      "kind": "LinkedField",
      "name": "systemApiKeys",
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
    },
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
          "name": "ViewerAPIKeysListFragment"
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "e6aa59faf8f449c0eb954a4e4b14761b";

export default node;
