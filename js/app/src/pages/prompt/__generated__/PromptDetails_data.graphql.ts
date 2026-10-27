/**
 * @generated SignedSource<<f38f68140839029c20c47e9ff48eace4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptDetails_data$data = {
  readonly id: string;
  readonly metadata: any;
  readonly " $fragmentType": "PromptDetails_data";
};
export type PromptDetails_data$key = {
  readonly " $data"?: PromptDetails_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptDetails_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptDetails_data",
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
      "name": "metadata",
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "872aaed3e4f8cab0be38859dc9766b97";

export default node;
