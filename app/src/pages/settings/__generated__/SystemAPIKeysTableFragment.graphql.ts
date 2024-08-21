/**
 * @generated SignedSource<<4bf1b1977c24e409e3f004bd2b964616>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SystemAPIKeysTableFragment$data = {
  readonly systemApiKeys: ReadonlyArray<{
    readonly createdAt: string;
    readonly description: string | null;
    readonly expiresAt: string | null;
    readonly id: string;
    readonly name: string;
  }>;
  readonly " $fragmentType": "SystemAPIKeysTableFragment";
};
export type SystemAPIKeysTableFragment$key = {
  readonly " $data"?: SystemAPIKeysTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SystemAPIKeysTableFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
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
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "74b725ff0b7b3ce3015ff314e8606cb7";

export default node;
