/**
 * @generated SignedSource<<8feae246cdf7a95e617ecf190544ce4c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionTagsConfigCard_data$data = {
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

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionTagsConfigCard_data",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "versionTags",
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

(node as any).hash = "e080b0dd81d8b1b8e299b2bcd2c3cec2";

export default node;
