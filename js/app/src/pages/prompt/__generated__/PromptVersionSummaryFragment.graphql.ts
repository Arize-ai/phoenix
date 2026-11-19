/**
 * @generated SignedSource<<25d670c420eb14cc85905723a5fad54c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionSummaryFragment$data = {
  readonly createdAt: string;
  readonly description: string | null;
  readonly id: string;
  readonly sequenceNumber: number;
  readonly tags: ReadonlyArray<{
    readonly id: string;
  }>;
  readonly user: {
    readonly id: string;
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsList_data">;
  readonly " $fragmentType": "PromptVersionSummaryFragment";
};
export type PromptVersionSummaryFragment$key = {
  readonly " $data"?: PromptVersionSummaryFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionSummaryFragment">;
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
  "name": "PromptVersionSummaryFragment",
  "selections": [
    (v0/*:: as any*/),
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
      "name": "sequenceNumber",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "user",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "username",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "profilePictureUrl",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "tags",
      "plural": true,
      "selections": [
        (v0/*:: as any*/)
      ],
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptVersionTagsList_data"
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};
})();

(node as any).hash = "f09e4b11703a96f6a882e631d2add5e7";

export default node;
