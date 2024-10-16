/**
 * @generated SignedSource<<6931dc528aea2b22801320e6d297dd58>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelPickerFragment$data = {
  readonly modelNames: ReadonlyArray<string>;
  readonly " $fragmentType": "ModelPickerFragment";
};
export type ModelPickerFragment$key = {
  readonly " $data"?: ModelPickerFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ModelPickerFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": "OPENAI",
      "kind": "LocalArgument",
      "name": "providerKey"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ModelPickerFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "fields": [
            {
              "kind": "Variable",
              "name": "providerKey",
              "variableName": "providerKey"
            }
          ],
          "kind": "ObjectValue",
          "name": "input"
        }
      ],
      "kind": "ScalarField",
      "name": "modelNames",
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "bb2557396c978bb5f57c7a4f67d756b1";

export default node;
