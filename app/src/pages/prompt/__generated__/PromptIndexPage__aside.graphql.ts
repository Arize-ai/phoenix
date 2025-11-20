/**
 * @generated SignedSource<<1e525dabb86b27475bf5e829b4f94a24>>
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
  readonly id: string;
  readonly metadata: any;
  readonly name: string;
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
      "name": "metadata",
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

(node as any).hash = "407e371e7602b5195f1061fef7705c23";

export default node;
