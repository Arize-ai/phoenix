/**
 * @generated SignedSource<<ed8271fff8b5764f1ab644abc17a0fd6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionTagsConfig_data$data = {
  readonly id: string;
  readonly versionTags: ReadonlyArray<{
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
    readonly promptVersion: {
      readonly id: string;
      readonly " $fragmentSpreads": FragmentRefs<"PromptVersionSummaryFragment">;
    };
  }>;
  readonly " $fragmentType": "PromptVersionTagsConfig_data";
};
export type PromptVersionTagsConfig_data$key = {
  readonly " $data"?: PromptVersionTagsConfig_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsConfig_data">;
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
  "name": "PromptVersionTagsConfig_data",
  "selections": [
    (v0/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "versionTags",
      "plural": true,
      "selections": [
        (v0/*:: as any*/),
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
          "concreteType": "PromptVersion",
          "kind": "LinkedField",
          "name": "promptVersion",
          "plural": false,
          "selections": [
            (v0/*:: as any*/),
            {
              "args": null,
              "kind": "FragmentSpread",
              "name": "PromptVersionSummaryFragment"
            }
          ],
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

(node as any).hash = "890bae48fd91f3daa8aa7d7239519bcc";

export default node;
