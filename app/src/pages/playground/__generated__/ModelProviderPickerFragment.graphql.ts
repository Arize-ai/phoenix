/**
 * @generated SignedSource<<8d3d09b89a6d54cc8b22d75946b7094b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "OPENAI";
import { FragmentRefs } from "relay-runtime";
export type ModelProviderPickerFragment$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly key: GenerativeProviderKey;
    readonly name: string;
  }>;
  readonly " $fragmentType": "ModelProviderPickerFragment";
};
export type ModelProviderPickerFragment$key = {
  readonly " $data"?: ModelProviderPickerFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ModelProviderPickerFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ModelProviderPickerFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "GenerativeProvider",
      "kind": "LinkedField",
      "name": "modelProviders",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "key",
          "storageKey": null
        },
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

(node as any).hash = "c83e86a2772127916f7387dca27b74ce";

export default node;
