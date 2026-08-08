/**
 * @generated SignedSource<<84f4a00cb5adddbbf037cece02f963e6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelsSettingsCardFragment$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelsTableFragment">;
  readonly " $fragmentType": "PromptLabelsSettingsCardFragment";
};
export type PromptLabelsSettingsCardFragment$key = {
  readonly " $data"?: PromptLabelsSettingsCardFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelsSettingsCardFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptLabelsSettingsCardFragment",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptLabelsTableFragment"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "a33febfbc1c6d2bdf5b65fdd5c292f52";

export default node;
