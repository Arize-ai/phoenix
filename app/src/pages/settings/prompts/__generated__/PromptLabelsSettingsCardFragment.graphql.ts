/**
 * @generated SignedSource<<486b790578eb76577aea7644c887ae20>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelsSettingsCardFragment$data = {
  readonly promptLabels: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "PromptLabelsSettingsCardFragment";
};
export type PromptLabelsSettingsCardFragment$key = {
  readonly " $data"?: PromptLabelsSettingsCardFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelsSettingsCardFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptLabelsSettingsCardFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptLabelConnection",
      "kind": "LinkedField",
      "name": "promptLabels",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptLabelEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "PromptLabel",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
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
                  "name": "color",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "f5203ff7ab4ab3fdb1113bf5c986073e";

export default node;
