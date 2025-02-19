/**
 * @generated SignedSource<<6ab7102d059d8f6fc33f8ec4b1efe187>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptResponseFormatFragment$data = {
  readonly responseFormat: {
    readonly definition: any;
  } | null;
  readonly " $fragmentType": "PromptResponseFormatFragment";
};
export type PromptResponseFormatFragment$key = {
  readonly " $data"?: PromptResponseFormatFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptResponseFormatFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptResponseFormatFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ResponseFormat",
      "kind": "LinkedField",
      "name": "responseFormat",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "definition",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "154d745ec5e978e0dfc811ebfb9faa8c";

export default node;
