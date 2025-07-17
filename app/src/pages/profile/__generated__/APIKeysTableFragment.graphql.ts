/**
 * @generated SignedSource<<1ead7f3321714ed6f5f2889b993125e3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type APIKeysTableFragment$data = {
  readonly apiKeys: ReadonlyArray<{
    readonly createdAt: string;
    readonly description: string | null;
    readonly expiresAt: string | null;
    readonly id: string;
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

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
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
      "concreteType": "UserApiKey",
      "kind": "LinkedField",
      "name": "apiKeys",
      "plural": true,
      "selections": [
        (v0/*: any*/),
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
    (v0/*: any*/)
  ],
  "type": "User",
  "abstractKey": null
};
})();

(node as any).hash = "6c32098d55e4cba859dcec73f3ccd28c";

export default node;
