/**
 * @generated SignedSource<<bfb8ef95095304fba5b3c34388984994>>
 * @lightSyntaxTransform
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
  readonly " $fragmentSpreads": FragmentRefs<"EditPromptButton_data" | "PromptLatestVersionsListFragment">;
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
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "4cdc821fb4e307327d25ea9ff40f7dce";

export default node;
