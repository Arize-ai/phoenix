/**
 * @generated SignedSource<<82dddf9178f3b330b61aed44077ef793>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionsPageContent__main$data = {
  readonly latestVersion: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionsList__main">;
  readonly " $fragmentType": "PromptVersionsPageContent__main";
};
export type PromptVersionsPageContent__main$key = {
  readonly " $data"?: PromptVersionsPageContent__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionsPageContent__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionsPageContent__main",
  "selections": [
    {
      "alias": "latestVersion",
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 1
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
      "storageKey": "promptVersions(first:1)"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptVersionsList__main"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "3fa2a6ea4f6905b2a6a02d0525bc6037";

export default node;
