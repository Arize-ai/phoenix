/**
 * @generated SignedSource<<c512bf9f0f381069751f7a41a3a98adc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionsPageContent__main$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionsList__main">;
  readonly " $fragmentType": "PromptVersionsPageContent__main";
};
export type PromptVersionsPageContent__main$key = {
  readonly " $data"?: PromptVersionsPageContent__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionsPageContent__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionsPageContent__main",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptVersionsList__main"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "994c1d93ccbab49fef121d5d73cd2b62";

export default node;
