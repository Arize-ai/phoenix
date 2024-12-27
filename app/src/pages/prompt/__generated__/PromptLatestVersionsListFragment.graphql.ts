/**
 * @generated SignedSource<<f0a1573a1009505663c27730bbc1033b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLatestVersionsListFragment$data = {
  readonly promptVersions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly description: string;
        readonly id: string;
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
      "alias": null,
      "args": null,
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
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "9c77ed418966e6a91cf3713f96fa9e3b";

export default node;
