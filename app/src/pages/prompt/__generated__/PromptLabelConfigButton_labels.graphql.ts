/**
 * @generated SignedSource<<95e5b37d075beeba9e722ee244bb1140>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButton_labels$data = {
  readonly promptLabels: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "PromptLabelConfigButton_labels";
};
export type PromptLabelConfigButton_labels$key = {
  readonly " $data"?: PromptLabelConfigButton_labels$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
};

import PromptLabelConfigButtonLabelsQuery_graphql from './PromptLabelConfigButtonLabelsQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": PromptLabelConfigButtonLabelsQuery_graphql
    }
  },
  "name": "PromptLabelConfigButton_labels",
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

(node as any).hash = "09b9b768949ee1d5ec9d8b86c5c6e1a4";

export default node;
