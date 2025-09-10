/**
 * @generated SignedSource<<cc0f66b9a8ba2cd588a06a2ee17b05ce>>
 * @lightSyntaxTransform
 * @nogrep
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
    readonly " $fragmentSpreads": FragmentRefs<"APIKeysTableFragment">;
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
          "name": "APIKeysTableFragment"
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "459f07f740e1b27f3839eedd3eff3083";

export default node;
