/**
 * @generated SignedSource<<7a525e50937728f25c8d335b0b74e869>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentsPageFragment$data = {
  readonly id: string;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentsTableFragment">;
  readonly " $fragmentType": "ExperimentsPageFragment";
};
export type ExperimentsPageFragment$key = {
  readonly " $data"?: ExperimentsPageFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentsPageFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentsPageFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "ExperimentsTableFragment"
    }
  ],
  "type": "Dataset",
  "abstractKey": null
};

(node as any).hash = "3bd35d0d90ba1a6e043ea3bf7067ff1c";

export default node;
