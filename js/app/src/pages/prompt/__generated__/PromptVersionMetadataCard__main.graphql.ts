/**
 * @generated SignedSource<<7019b91b085c19e0b79daa5c3e4655cf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionMetadataCard__main$data = {
  readonly metadata: any;
  readonly " $fragmentType": "PromptVersionMetadataCard__main";
};
export type PromptVersionMetadataCard__main$key = {
  readonly " $data"?: PromptVersionMetadataCard__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionMetadataCard__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionMetadataCard__main",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "metadata",
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "07a39fdefda77ea800a8f83222592df9";

export default node;
