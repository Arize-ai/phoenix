/**
 * @generated SignedSource<<3ab0bbbfa99d56ef73ab05635a64d7b2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionDetailsPage__prompt$data = {
  readonly latestVersions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionDiffPicker__versions">;
  readonly " $fragmentType": "PromptVersionDetailsPage__prompt";
};
export type PromptVersionDetailsPage__prompt$key = {
  readonly " $data"?: PromptVersionDetailsPage__prompt$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionDetailsPage__prompt">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionDetailsPage__prompt",
  "selections": [
    {
      "alias": "latestVersions",
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 2
        }
      ],
      "concreteType": "PromptVersionConnection",
      "kind": "LinkedField",
      "name": "promptVersions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptVersionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "PromptVersion",
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
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "promptVersions(first:2)"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptVersionDiffPicker__versions"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "8c11c74860a16d06bf5d19bac7d111b4";

export default node;
