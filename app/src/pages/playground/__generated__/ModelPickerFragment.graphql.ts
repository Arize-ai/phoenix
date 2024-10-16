/**
 * @generated SignedSource<<b2e9cdb73d732f72169cf02e0b5f87d5>>
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

(node as any).hash = "1e660ad77ce19db1c1bbe8698a661b4f";

export default node;
