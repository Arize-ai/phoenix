/**
 * @generated SignedSource<<2785c6443bb161624c5566704de898d2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionTagsConfigCard_data$data = {
  readonly id: string;
  readonly versionTags: ReadonlyArray<{
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
    readonly promptVersionId: string;
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "promptVersionId",
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

(node as any).hash = "3650e60f18eb8d95b707df7bdbce99a9";

export default node;
