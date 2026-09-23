/**
 * @generated SignedSource<<4fe0a85ac71e5aa374beac2b956d4e24>>
 * @lightSyntaxTransform
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
    readonly profilePictureUrl: string | null;
    readonly role: {
      readonly name: string;
    };
    readonly username: string;
    readonly " $fragmentSpreads": FragmentRefs<"AuthorizedApplicationsCardFragment" | "ViewerAPIKeysListFragment">;
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
          "name": "ViewerAPIKeysListFragment"
        },
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "AuthorizedApplicationsCardFragment"
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "53341d080ff76da24b2f1bc9e36c4e23";

export default node;
