/**
 * @generated SignedSource<<6631cac64643cbc5c435a2ff79c3b759>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type APIKeysTableFragment$data = {
  readonly apiKeys: ReadonlyArray<{
    readonly createdAt: string;
    readonly description: string | null;
    readonly expiresAt: string | null;
    readonly name: string;
  }>;
  readonly id: string;
  readonly " $fragmentType": "APIKeysTableFragment";
};
export type APIKeysTableFragment$key = {
  readonly " $data"?: APIKeysTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"APIKeysTableFragment">;
};

import APIKeysTableQuery_graphql from './APIKeysTableQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": APIKeysTableQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "APIKeysTableFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "apiKeys",
      "plural": true,
      "selections": [
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
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "User",
  "abstractKey": null
};

(node as any).hash = "b5cc950482c8d88a792df5819f895c23";

export default node;
