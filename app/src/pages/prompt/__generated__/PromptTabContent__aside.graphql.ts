/**
 * @generated SignedSource<<4e979aefd80106702a0c4ca619a33e44>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptTabContent__aside$data = {
  readonly description: string | null;
  readonly " $fragmentType": "PromptTabContent__aside";
};
export type PromptTabContent__aside$key = {
  readonly " $data"?: PromptTabContent__aside$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptTabContent__aside">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptTabContent__aside",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "description",
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "bd08ff2f3a8ad88395e43d393eb2b9a5";

export default node;
