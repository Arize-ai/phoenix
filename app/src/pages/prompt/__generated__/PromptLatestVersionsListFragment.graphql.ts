/**
 * @generated SignedSource<<eb0da5e686dfedfa2ecfe7b6e5645071>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLatestVersionsListFragment$data = {
  readonly latestVersions: {
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

(node as any).hash = "87e8c1a015201c696ee01c008ec310f3";

export default node;
