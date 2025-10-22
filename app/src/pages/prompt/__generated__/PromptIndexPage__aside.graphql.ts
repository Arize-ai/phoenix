/**
 * @generated SignedSource<<a9390838fef84c4e81c325171a443d04>>
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

(node as any).hash = "6e55ee290c371e77c5c16041c8f55cd8";

export default node;
