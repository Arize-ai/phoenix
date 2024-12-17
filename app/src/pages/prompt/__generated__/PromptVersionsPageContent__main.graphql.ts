/**
 * @generated SignedSource<<b97b68f9da9f3079add560d18f4052e7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionsPageContent__main$data = {
  readonly createdAt: string;
  readonly " $fragmentType": "PromptVersionsPageContent__main";
};
export type PromptVersionsPageContent__main$key = {
  readonly " $data"?: PromptVersionsPageContent__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionsPageContent__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionsPageContent__main",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "1c40d928a5393dd0aa8b13c7d3219beb";

export default node;
