/**
 * @generated SignedSource<<1ecb9d526bace62adc934d30278eb434>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
export type AuthMethod = "LOCAL" | "OAUTH2";
import { FragmentRefs } from "relay-runtime";
export type UsersTable_users$data = {
  readonly users: {
    readonly edges: ReadonlyArray<{
      readonly user: {
        readonly authMethod: AuthMethod;
        readonly createdAt: string;
        readonly email: string;
        readonly id: string;
        readonly role: {
          readonly name: string;
        };
        readonly username: string | null;
      };
    }>;
  };
  readonly " $fragmentType": "UsersTable_users";
};
export type UsersTable_users$key = {
  readonly " $data"?: UsersTable_users$data;
  readonly " $fragmentSpreads": FragmentRefs<"UsersTable_users">;
};

import UsersTableQuery_graphql from './UsersTableQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": UsersTableQuery_graphql
    }
  },
  "name": "UsersTable_users",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "UserConnection",
      "kind": "LinkedField",
      "name": "users",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "UserEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "user",
              "args": null,
              "concreteType": "User",
              "kind": "LinkedField",
              "name": "node",
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
                  "name": "email",
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
                  "name": "createdAt",
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
                }
              ],
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

(node as any).hash = "708ed551407313a5657fd95d5ba5ac9f";

export default node;
