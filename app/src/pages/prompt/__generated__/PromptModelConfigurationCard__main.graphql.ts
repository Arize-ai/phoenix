/**
 * @generated SignedSource<<a03c978994d905c3e9228d3b58a8dce4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptModelConfigurationCard__main$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParameters__main">;
  readonly " $fragmentType": "PromptModelConfigurationCard__main";
};
export type PromptModelConfigurationCard__main$key = {
  readonly " $data"?: PromptModelConfigurationCard__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptModelConfigurationCard__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptModelConfigurationCard__main",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptInvocationParameters__main"
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "be38033bab307b3e8630ec6941c5d62d";

export default node;
