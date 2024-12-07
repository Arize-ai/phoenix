/**
 * @generated SignedSource<<1fc5d404ed071722545c5fd9be003a9e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ModelComboBoxFragment$data = {
  readonly models: ReadonlyArray<{
    readonly name: string;
  }>;
  readonly " $fragmentType": "ModelComboBoxFragment";
};
export type ModelComboBoxFragment$key = {
  readonly " $data"?: ModelComboBoxFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ModelComboBoxFragment">;
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
  "name": "ModelComboBoxFragment",
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

(node as any).hash = "4d750697cdf7a1f73778a9e36a765e80";

export default node;
