/**
 * @generated SignedSource<<2f6a03d56a2b1c81095de0c7a7fceabc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type UsersTable_users$data = {
  readonly users: {
    readonly edges: ReadonlyArray<{
      readonly user: {
        readonly createdAt: string;
        readonly email: string;
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

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
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

(node as any).hash = "a87302705dfc7b091db312313f46ec4f";

export default node;
