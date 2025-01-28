/**
 * @generated SignedSource<<f634164d7447ff9777b0b49c95d91089>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionTagsList_data$data = {
  readonly tags: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly " $fragmentType": "PromptVersionTagsList_data";
};
export type PromptVersionTagsList_data$key = {
  readonly " $data"?: PromptVersionTagsList_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsList_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionTagsList_data",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
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
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "25265fbc7ea915534615a56b4331236e";

export default node;
