/**
 * @generated SignedSource<<4551ae961b58e6ef27c876b84be455f0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AuthMethod = "LDAP" | "LOCAL" | "OAUTH2";
import { FragmentRefs } from "relay-runtime";
export type ViewerContext_viewer$data = {
  readonly viewer: {
    readonly authMethod: AuthMethod;
    readonly email: string | null;
    readonly id: string;
    readonly isManagementUser: boolean;
    readonly passwordNeedsReset: boolean;
    readonly profilePictureUrl: string | null;
    readonly role: {
      readonly name: string;
    };
    readonly username: string;
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
          "kind": "ScalarField",
          "name": "passwordNeedsReset",
          "storageKey": null
        },
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
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "authMethod",
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

(node as any).hash = "34387f21cc34b249e4f2a4bb62d85671";

export default node;
