/**
 * @generated SignedSource<<ae069c5885ff2b79cd4eed7d5b366115>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ResetPasswordFormQuery$data = {
  readonly viewer: {
    readonly email: string | null;
  } | null;
  readonly " $fragmentType": "ResetPasswordFormQuery";
};
export type ResetPasswordFormQuery$key = {
  readonly " $data"?: ResetPasswordFormQuery$data;
  readonly " $fragmentSpreads": FragmentRefs<"ResetPasswordFormQuery">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ResetPasswordFormQuery",
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

(node as any).hash = "1161643b76edb6ef437d8f136038cf21";

export default node;
