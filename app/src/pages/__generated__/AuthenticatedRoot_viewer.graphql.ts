/**
 * @generated SignedSource<<55cf7fe1e2004847634e1bf612d3466b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AuthenticatedRoot_viewer$data = {
  readonly viewer: {
    readonly email: string | null;
    readonly id: string;
    readonly username: string;
  } | null;
  readonly " $fragmentType": "AuthenticatedRoot_viewer";
};
export type AuthenticatedRoot_viewer$key = {
  readonly " $data"?: AuthenticatedRoot_viewer$data;
  readonly " $fragmentSpreads": FragmentRefs<"AuthenticatedRoot_viewer">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "AuthenticatedRoot_viewer",
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "0714d5f0ce98d0d400273eb36b7d8a36";

export default node;
