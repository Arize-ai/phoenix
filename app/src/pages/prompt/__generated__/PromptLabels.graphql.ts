/**
 * @generated SignedSource<<52bf8bb325d7cdaa7ada60b3dae04ea2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabels$data = {
  readonly labels: ReadonlyArray<{
    readonly color: string;
    readonly name: string;
  }>;
  readonly " $fragmentType": "PromptLabels";
};
export type PromptLabels$key = {
  readonly " $data"?: PromptLabels$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabels">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptLabels",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
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
          "name": "color",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "ab226cfebdec9e458000b1041eae54fa";

export default node;
