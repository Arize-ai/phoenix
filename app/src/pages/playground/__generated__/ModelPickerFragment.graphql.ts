/**
 * @generated SignedSource<<a48ab416d29b560ef4704c5a7fe70f92>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelPickerFragment$data = {
  readonly models: ReadonlyArray<{
    readonly name: string;
  }>;
  readonly " $fragmentType": "ModelPickerFragment";
};
export type ModelPickerFragment$key = {
  readonly " $data"?: ModelPickerFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ModelPickerFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "modelName"
    },
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
              "name": "modelName",
              "variableName": "modelName"
            },
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
      "concreteType": "GenerativeModel",
      "kind": "LinkedField",
      "name": "models",
      "plural": true,
      "selections": [
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
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "6e934dba55fab7f5e6f19758b10b624c";

export default node;
