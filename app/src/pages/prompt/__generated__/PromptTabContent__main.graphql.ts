/**
 * @generated SignedSource<<9581c864b76a73e28bad69c604b1e14c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptTabContent__main$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptTabContent__aside">;
  readonly " $fragmentType": "PromptTabContent__main";
};
export type PromptTabContent__main$key = {
  readonly " $data"?: PromptTabContent__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptTabContent__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptTabContent__main",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptTabContent__aside"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "cbe89e848d231a4df17e6047814894ed";

export default node;
