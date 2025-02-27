/**
 * @generated SignedSource<<b12def029d6c48033847baaccae5ae6b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLatestVersionsListFragment$data = {
  readonly latestVersions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly createdAt: string;
        readonly description: string | null;
        readonly id: string;
        readonly sequenceNumber: number;
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionSummaryFragment">;
      };
    }>;
  };
  readonly " $fragmentType": "PromptLatestVersionsListFragment";
};
export type PromptLatestVersionsListFragment$key = {
  readonly " $data"?: PromptLatestVersionsListFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLatestVersionsListFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptLatestVersionsListFragment",
  "selections": [
    {
      "alias": "latestVersions",
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 5
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
              "alias": "version",
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
                  "name": "createdAt",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sequenceNumber",
                  "storageKey": null
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptVersionSummaryFragment"
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "promptVersions(first:5)"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "a473a6f0d927379542694312449a4c63";

export default node;
