/**
 * @generated SignedSource<<be9924215eda06be678465f7cd8f5b33>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptIndexPage__main$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__aside">;
  readonly " $fragmentType": "PromptIndexPage__main";
};
export type PromptIndexPage__main$key = {
  readonly " $data"?: PromptIndexPage__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptIndexPage__main",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptIndexPage__aside"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "25a4ebead60b4112b552a38954277093";

export default node;
