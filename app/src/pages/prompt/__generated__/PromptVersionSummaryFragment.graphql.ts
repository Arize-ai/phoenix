/**
 * @generated SignedSource<<0ed037dca1074df69208bd73a032767a>>
 * @lightSyntaxTransform
 * @nogrep
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
    (v0/*: any*/),
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
        (v0/*: any*/),
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
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptVersionTagsList_data"
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};
})();

(node as any).hash = "80901eff49852a413f643ee876638174";

export default node;
