/**
 * @generated SignedSource<<06d552a58f5ef8cbb50a4cc5280dce33>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionTagsList_data$data = {
  readonly tags: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly " $fragmentType": "DecisionVersionTagsList_data";
};
export type DecisionVersionTagsList_data$key = {
  readonly " $data"?: DecisionVersionTagsList_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionTagsList_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionVersionTagsList_data",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionVersionTag",
      "kind": "LinkedField",
      "name": "tags",
      "plural": true,
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
          "name": "name",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DecisionVersion",
  "abstractKey": null
};

(node as any).hash = "55cec843eb14b7748abb03a1d9554c3a";

export default node;
