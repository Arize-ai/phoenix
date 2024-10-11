/**
 * @generated SignedSource<<3ea2d3c123a67eedf3cfe075d801e5e2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelPickerFragment$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly modelNames: ReadonlyArray<string>;
    readonly name: string;
  }>;
  readonly " $fragmentType": "ModelPickerFragment";
};
export type ModelPickerFragment$key = {
  readonly " $data"?: ModelPickerFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ModelPickerFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ModelPickerFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "vendors",
          "value": [
            "OpenAI",
            "Anthropic"
          ]
        }
      ],
      "concreteType": "ModelProvider",
      "kind": "LinkedField",
      "name": "modelProviders",
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
          "name": "modelNames",
          "storageKey": null
        }
      ],
      "storageKey": "modelProviders(vendors:[\"OpenAI\",\"Anthropic\"])"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "0c369d2705c164e6d3bf698b9fdaa934";

export default node;
