/**
 * @generated SignedSource<<2f9e63ef0040e4c11fb576435e5e5fcc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SystemAPIKeysTableFragment$data = {
  readonly systemApiKeys: ReadonlyArray<{
    readonly createdAt: string;
    readonly description: string | null;
    readonly expiresAt: string | null;
    readonly name: string;
  }>;
  readonly " $fragmentType": "SystemAPIKeysTableFragment";
};
export type SystemAPIKeysTableFragment$key = {
  readonly " $data"?: SystemAPIKeysTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment">;
};

import SystemAPIKeysTableRefetchQuery_graphql from './SystemAPIKeysTableRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": SystemAPIKeysTableRefetchQuery_graphql
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

(node as any).hash = "5b1b306f178fa0e790415c5e375cba5f";

export default node;
