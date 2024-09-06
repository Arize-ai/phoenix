/**
 * @generated SignedSource<<ee9672b89d0875c89b646a1081277a2e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ViewerContext_viewer$data = {
  readonly viewer: {
    readonly email: string;
    readonly id: string;
    readonly role: {
      readonly name: string;
    };
    readonly username: string | null;
    readonly " $fragmentSpreads": FragmentRefs<"APIKeysTableFragment">;
  } | null;
  readonly " $fragmentType": "ViewerContext_viewer";
};
export type ViewerContext_viewer$key = {
  readonly " $data"?: ViewerContext_viewer$data;
  readonly " $fragmentSpreads": FragmentRefs<"ViewerContext_viewer">;
};

import ViewerContextRefetchQuery_graphql from './ViewerContextRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": ViewerContextRefetchQuery_graphql
    }
  },
  "name": "ViewerContext_viewer",
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
          "name": "username",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "email",
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
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "name",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
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

(node as any).hash = "60a8f9b353f4cc5c8734971ca698d497";

export default node;
