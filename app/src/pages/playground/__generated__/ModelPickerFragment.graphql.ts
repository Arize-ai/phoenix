/**
 * @generated SignedSource<<8b2439a54797d5c681f07edb1f7e43c4>>
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
      "args": null,
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
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "766b2efbb5fd72b914f7a5f67ccd31cf";

export default node;
