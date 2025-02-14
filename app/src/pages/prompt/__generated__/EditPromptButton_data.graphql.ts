/**
 * @generated SignedSource<<4454e2014fd298c353859375ead64f20>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EditPromptButton_data$data = {
  readonly description: string | null;
  readonly id: string;
  readonly " $fragmentType": "EditPromptButton_data";
};
export type EditPromptButton_data$key = {
  readonly " $data"?: EditPromptButton_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"EditPromptButton_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EditPromptButton_data",
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
      "name": "description",
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "24788aacf7830c0e5037befe576f4968";

export default node;
