/**
 * @generated SignedSource<<a6eb79a325ddb0f5dab5e7816a0d2f84>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptIndexPage__aside$data = {
  readonly description: string | null;
  readonly " $fragmentSpreads": FragmentRefs<"EditPromptButton_data" | "PromptLabels" | "PromptLatestVersionsListFragment">;
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
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "EditPromptButton_data"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptLabels"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "750c91f76d6b251d1b082560e99c2108";

export default node;
