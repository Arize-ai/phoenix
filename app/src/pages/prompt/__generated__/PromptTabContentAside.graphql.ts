/**
 * @generated SignedSource<<ed68ba550445c4d5e191078a0f2bca59>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptTabContentAside$data = {
  readonly description: string | null;
  readonly " $fragmentType": "PromptTabContentAside";
};
export type PromptTabContentAside$key = {
  readonly " $data"?: PromptTabContentAside$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptTabContentAside">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptTabContentAside",
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

(node as any).hash = "fcbfa5483834ff754307a46a54bce43f";

export default node;
