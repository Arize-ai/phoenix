/**
 * @generated SignedSource<<198e90844b3c381d667061ccc0f7a9b6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptResponseFormatFragment$data = {
  readonly responseFormat: {
    readonly jsonSchema: {
      readonly description: string | null;
      readonly name: string;
      readonly schema: any | null;
      readonly strict: boolean | null;
    };
  } | null;
  readonly " $fragmentType": "PromptResponseFormatFragment";
};
export type PromptResponseFormatFragment$key = {
  readonly " $data"?: PromptResponseFormatFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptResponseFormatFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptResponseFormatFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptResponseFormatJSONSchema",
      "kind": "LinkedField",
      "name": "responseFormat",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptResponseFormatJSONSchemaDefinition",
          "kind": "LinkedField",
          "name": "jsonSchema",
          "plural": false,
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
              "name": "description",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "schema",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "strict",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "b3e879309fe87a12c3d0ba4aa88fef6b";

export default node;
