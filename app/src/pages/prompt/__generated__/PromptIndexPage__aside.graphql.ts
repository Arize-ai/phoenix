/**
 * @generated SignedSource<<0d6c8a6a19d8462c1d4a08d1322c61e5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptIndexPage__aside$data = {
  readonly description: string | null;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLatestVersionsListFragment">;
  readonly " $fragmentType": "PromptIndexPage__aside";
};
export type PromptIndexPage__aside$key = {
  readonly " $data"?: PromptIndexPage__aside$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__aside">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptIndexPage__aside",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptLatestVersionsListFragment"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "8e6287bde2de600156e2ccf4467944c4";

export default node;
