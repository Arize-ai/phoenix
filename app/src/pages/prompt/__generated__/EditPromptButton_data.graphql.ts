/**
 * @generated SignedSource<<1c7658cd29999f5be4210d26ad2b493d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EditPromptButton_data$data = {
  readonly description: string | null;
  readonly id: string;
  readonly metadata: any;
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "metadata",
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "f1d8e195768db742eb9070b7ad56ce0f";

export default node;
