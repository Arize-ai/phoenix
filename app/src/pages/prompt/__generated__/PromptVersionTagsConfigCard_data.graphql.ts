/**
 * @generated SignedSource<<a00e723f7ba26751cde89d334c9af7fa>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionTagsConfigCard_data$data = {
  readonly id: string;
  readonly versionTags: ReadonlyArray<{
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
  }>;
  readonly " $fragmentType": "PromptVersionTagsConfigCard_data";
};
export type PromptVersionTagsConfigCard_data$key = {
  readonly " $data"?: PromptVersionTagsConfigCard_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsConfigCard_data">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionTagsConfigCard_data",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "versionTags",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "description",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};
})();

(node as any).hash = "8a904c5cedada821af5fa5ff740261f5";

export default node;
