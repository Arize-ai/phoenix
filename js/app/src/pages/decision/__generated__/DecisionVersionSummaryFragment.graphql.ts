/**
 * @generated SignedSource<<35f4ac02330cfb38151e2c7288115367>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionSummaryFragment$data = {
  readonly createdAt: string;
  readonly description: string | null;
  readonly id: string;
  readonly sequenceNumber: number;
  readonly user: {
    readonly id: string;
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionTagsList_data">;
  readonly " $fragmentType": "DecisionVersionSummaryFragment";
};
export type DecisionVersionSummaryFragment$key = {
  readonly " $data"?: DecisionVersionSummaryFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionSummaryFragment">;
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
  "name": "DecisionVersionSummaryFragment",
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
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionVersionTagsList_data"
    }
  ],
  "type": "DecisionVersion",
  "abstractKey": null
};
})();

(node as any).hash = "7e090eb225e0b8750c286a00a3919d01";

export default node;
